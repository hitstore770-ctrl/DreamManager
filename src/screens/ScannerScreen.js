import { useEffect, useRef, useState } from "react";
import { StyleSheet, TouchableOpacity, useWindowDimensions, View } from "react-native";
import AppText from "../components/AppText";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Defs, FeColorMatrix, FeComponentTransfer, FeFuncB, FeFuncG, FeFuncR, Filter, Image as SvgImage } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useTheme } from "../theme/ThemeContext";
import { t } from "../i18n/strings";
import SwipeBack from "../navigation/SwipeBack";

const HANDLE = 26;
const MIN_CROP = 60;
const EXPORT_MAX = 1600;
const FILTERS = [
  { key: "none", label: t("filterNone") },
  { key: "gray", label: t("filterGray") },
  { key: "contrast", label: t("filterContrast") },
];

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// The Offline Document Scanner: capture with the device camera, drag the
// two corner handles to crop, pick a grayscale/high-contrast look, then
// rasterize crop+filter together into one flat PNG via an off-screen SVG's
// toDataURL() -- the exact technique WhiteboardScreen uses to flatten
// strokes onto a background image, just with a crop offset instead of
// strokes. The result is embedded with the same ```drawing fence the
// Whiteboard writes, so MarkdownView needs no new block type to show it.
export default function ScannerScreen({ navigation, route }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const onSave = route.params?.onSave;
  const [permission, requestPermission] = useCameraPermissions();
  // SwipeBack wraps every screen's content in a PanGestureHandler +
  // Animated.View, which on web keeps this screen's own onLayout from ever
  // firing on a plain descendant View -- sizing off the window instead
  // (the same fix GraphScreen/WhiteboardScreen already use for their
  // canvases) sidesteps that rather than depending on a callback that
  // never comes.
  const { width: winW } = useWindowDimensions();
  const displayW = Math.round(Math.min(winW - 28, 640));

  const [photo, setPhoto] = useState(null); // { uri, width, height }
  const [crop, setCrop] = useState(null); // { x1, y1, x2, y2 } in display space
  const [filter, setFilter] = useState("none");
  const cameraRef = useRef(null);
  const exportRef = useRef(null);
  const cropRef = useRef(null);

  const displayH = photo ? Math.round((displayW * photo.height) / photo.width) : 0;

  const setCropClamped = (next) => {
    const x1 = clamp(next.x1, 0, displayW - MIN_CROP);
    const y1 = clamp(next.y1, 0, displayH - MIN_CROP);
    const x2 = clamp(next.x2, x1 + MIN_CROP, displayW);
    const y2 = clamp(next.y2, y1 + MIN_CROP, displayH);
    const clamped = { x1, y1, x2, y2 };
    cropRef.current = clamped;
    setCrop(clamped);
  };

  useEffect(() => {
    if (!photo) return;
    const inset = Math.min(displayW, displayH) * 0.06;
    setCropClamped({ x1: inset, y1: inset, x2: displayW - inset, y2: displayH - inset });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo]);

  const takePicture = async () => {
    if (!cameraRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const shot = await cameraRef.current.takePictureAsync({ quality: 0.9 });
    setPhoto(shot);
    setCrop(null);
    setFilter("none");
  };

  const retake = () => {
    setPhoto(null);
    setCrop(null);
    setDisplayW(0);
  };

  const makeCornerPan = (corner) =>
    Gesture.Pan()
      .runOnJS(true)
      .onUpdate((e) => {
        const base = cropRef.current || crop;
        if (!base) return;
        if (corner === "tl") setCropClamped({ ...base, x1: e.x, y1: e.y });
        else setCropClamped({ ...base, x2: e.x, y2: e.y });
      });

  const tlPan = makeCornerPan("tl");
  const brPan = makeCornerPan("br");

  const confirm = () => {
    if (!photo || !crop || !displayW) return;
    const { ew, eh } = exportGeomFor(photo, crop, displayW);
    exportRef.current?.toDataURL(
      (base64) => {
        onSave?.(base64);
        navigation.goBack();
      },
      { width: ew, height: eh }
    );
  };

  const exportGeom =
    photo && crop && displayW ? exportGeomFor(photo, crop, displayW) : { fullW: 0, fullH: 0, ex1: 0, ey1: 0, ew: 1, eh: 1 };

  const s = styles(theme);

  if (!permission) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;

  if (!permission.granted) {
    return (
      <SwipeBack onDismiss={() => navigation.goBack()} style={{ backgroundColor: theme.bg, paddingTop: insets.top }}>
        <View style={s.topBar}>
          <TouchableOpacity testID="scanner-back" style={s.iconBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Feather name="chevron-left" size={22} color={theme.text} />
          </TouchableOpacity>
          <AppText style={s.topTitle}>{t("scanner")}</AppText>
        </View>
        <View style={s.permissionWrap}>
          <Feather name="camera" size={40} color={theme.textMuted} />
          <AppText style={s.permissionTitle}>{t("cameraPermissionTitle")}</AppText>
          <AppText style={s.permissionHint}>{t("cameraPermissionHint")}</AppText>
          <TouchableOpacity testID="grant-camera" style={[s.primaryBtn, { backgroundColor: theme.accent }]} onPress={requestPermission}>
            <AppText style={{ color: theme.onAccent, fontWeight: "700", fontSize: 14.5 }}>{t("grantAccess")}</AppText>
          </TouchableOpacity>
        </View>
      </SwipeBack>
    );
  }

  return (
    <SwipeBack onDismiss={() => navigation.goBack()} style={{ backgroundColor: theme.bg, paddingTop: insets.top }}>
      <View style={s.topBar}>
        <TouchableOpacity testID="scanner-back" style={s.iconBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Feather name="chevron-left" size={22} color={theme.text} />
        </TouchableOpacity>
        <Feather name="camera" size={16} color={theme.textMuted} style={{ marginStart: 6, marginEnd: 6 }} />
        <AppText style={s.topTitle}>{t("scanner")}</AppText>
      </View>

      {!photo ? (
        <>
          <View style={{ flex: 1, margin: 14, borderRadius: 18, overflow: "hidden", backgroundColor: "#000" }}>
            <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
          </View>
          <View style={s.captureRow}>
            <TouchableOpacity testID="scanner-capture" style={[s.captureBtn, { borderColor: theme.accent }]} onPress={takePicture}>
              <View style={[s.captureDot, { backgroundColor: theme.accent }]} />
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <View style={{ flex: 1 }}>
            {!!displayH && (
              <View style={{ width: displayW, height: displayH, alignSelf: "center", marginTop: 10 }}>
                <Svg width={displayW} height={displayH}>
                  <Defs>
                    <Filter id="grayPreview" x="-20%" y="-20%" width="140%" height="140%">
                      <FeColorMatrix type="saturate" values="0" />
                    </Filter>
                    <Filter id="contrastPreview" x="-20%" y="-20%" width="140%" height="140%">
                      <FeColorMatrix type="saturate" values="0" />
                      <FeComponentTransfer>
                        <FeFuncR type="linear" slope="1.7" intercept="-0.32" />
                        <FeFuncG type="linear" slope="1.7" intercept="-0.32" />
                        <FeFuncB type="linear" slope="1.7" intercept="-0.32" />
                      </FeComponentTransfer>
                    </Filter>
                  </Defs>
                  <SvgImage
                    href={{ uri: photo.uri }}
                    x={0}
                    y={0}
                    width={displayW}
                    height={displayH}
                    preserveAspectRatio="none"
                    filter={filter === "none" ? undefined : `url(#${filter === "gray" ? "grayPreview" : "contrastPreview"})`}
                  />
                </Svg>

                {!!crop && (
                  <>
                    <View pointerEvents="none" style={[s.mask, { left: 0, top: 0, width: displayW, height: crop.y1 }]} />
                    <View pointerEvents="none" style={[s.mask, { left: 0, top: crop.y2, width: displayW, height: displayH - crop.y2 }]} />
                    <View pointerEvents="none" style={[s.mask, { left: 0, top: crop.y1, width: crop.x1, height: crop.y2 - crop.y1 }]} />
                    <View pointerEvents="none" style={[s.mask, { left: crop.x2, top: crop.y1, width: displayW - crop.x2, height: crop.y2 - crop.y1 }]} />
                    <View
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        left: crop.x1,
                        top: crop.y1,
                        width: crop.x2 - crop.x1,
                        height: crop.y2 - crop.y1,
                        borderWidth: 2,
                        borderColor: theme.accent,
                      }}
                    />
                    <GestureDetector gesture={tlPan}>
                      <View testID="crop-handle-tl" style={[s.handle, { left: crop.x1 - HANDLE / 2, top: crop.y1 - HANDLE / 2, borderColor: theme.accent }]} />
                    </GestureDetector>
                    <GestureDetector gesture={brPan}>
                      <View testID="crop-handle-br" style={[s.handle, { left: crop.x2 - HANDLE / 2, top: crop.y2 - HANDLE / 2, borderColor: theme.accent }]} />
                    </GestureDetector>
                  </>
                )}
              </View>
            )}
          </View>

          <View style={s.filterRow}>
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f.key}
                testID={`scanner-filter-${f.key}`}
                style={[s.filterBtn, filter === f.key && { backgroundColor: theme.accent }]}
                onPress={() => setFilter(f.key)}
              >
                <AppText style={{ fontSize: 12.5, fontWeight: "600", color: filter === f.key ? theme.onAccent : theme.text }}>{f.label}</AppText>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.actionRow}>
            <TouchableOpacity testID="scanner-retake" style={[s.btn, s.btnGhost]} onPress={retake} activeOpacity={0.8}>
              <Feather name="rotate-ccw" size={15} color={theme.text} />
              <AppText style={{ color: theme.text, fontWeight: "700", fontSize: 14, marginStart: 6 }}>{t("retake")}</AppText>
            </TouchableOpacity>
            <TouchableOpacity testID="scanner-confirm" style={[s.btn, { backgroundColor: theme.accent }]} onPress={confirm} activeOpacity={0.85}>
              <Feather name="check" size={15} color={theme.onAccent} />
              <AppText style={{ color: theme.onAccent, fontWeight: "700", fontSize: 14, marginStart: 6 }}>{t("usePhoto")}</AppText>
            </TouchableOpacity>
          </View>

          {/* Off-screen export canvas: full-resolution image shifted by the
              crop origin so only the cropped region falls inside its
              (ew x eh) bounds, with the same filter as the preview above.
              toDataURL() rasterizes exactly this element. */}
          {!!photo && !!crop && !!displayW && (
            <View style={{ position: "absolute", left: -99999, top: 0 }}>
              <Svg ref={exportRef} width={exportGeom.ew} height={exportGeom.eh}>
                <Defs>
                  <Filter id="grayExport" x="-20%" y="-20%" width="140%" height="140%">
                    <FeColorMatrix type="saturate" values="0" />
                  </Filter>
                  <Filter id="contrastExport" x="-20%" y="-20%" width="140%" height="140%">
                    <FeColorMatrix type="saturate" values="0" />
                    <FeComponentTransfer>
                      <FeFuncR type="linear" slope="1.7" intercept="-0.32" />
                      <FeFuncG type="linear" slope="1.7" intercept="-0.32" />
                      <FeFuncB type="linear" slope="1.7" intercept="-0.32" />
                    </FeComponentTransfer>
                  </Filter>
                </Defs>
                <SvgImage
                  href={{ uri: photo.uri }}
                  x={-exportGeom.ex1}
                  y={-exportGeom.ey1}
                  width={exportGeom.fullW}
                  height={exportGeom.fullH}
                  preserveAspectRatio="none"
                  filter={filter === "none" ? undefined : `url(#${filter === "gray" ? "grayExport" : "contrastExport"})`}
                />
              </Svg>
            </View>
          )}
        </>
      )}
    </SwipeBack>
  );
}

function exportGeomFor(photo, crop, displayW) {
  const displayScale = displayW / photo.width;
  const px1 = crop.x1 / displayScale;
  const py1 = crop.y1 / displayScale;
  const px2 = crop.x2 / displayScale;
  const py2 = crop.y2 / displayScale;
  const exportScale = Math.min(1, EXPORT_MAX / Math.max(photo.width, photo.height));
  return {
    fullW: Math.round(photo.width * exportScale),
    fullH: Math.round(photo.height * exportScale),
    ex1: Math.round(px1 * exportScale),
    ey1: Math.round(py1 * exportScale),
    ew: Math.max(1, Math.round((px2 - px1) * exportScale)),
    eh: Math.max(1, Math.round((py2 - py1) * exportScale)),
  };
}

const styles = (t) =>
  StyleSheet.create({
    topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8 },
    iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: t.surfaceAlt },
    topTitle: { fontSize: 17, fontWeight: "700", color: t.text },
    captureRow: { alignItems: "center", paddingVertical: 18 },
    captureBtn: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, alignItems: "center", justifyContent: "center" },
    captureDot: { width: 54, height: 54, borderRadius: 27 },
    mask: { position: "absolute", backgroundColor: "rgba(0,0,0,0.5)" },
    handle: {
      position: "absolute",
      width: HANDLE,
      height: HANDLE,
      borderRadius: HANDLE / 2,
      borderWidth: 3,
      backgroundColor: "#FFFFFF",
    },
    filterRow: { flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: 10 },
    filterBtn: { paddingHorizontal: 14, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: t.surfaceAlt },
    actionRow: { flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingBottom: 16 },
    btn: { flex: 1, height: 46, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center" },
    btnGhost: { backgroundColor: t.surfaceAlt },
    permissionWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30, gap: 10 },
    permissionTitle: { fontSize: 16, fontWeight: "700", color: t.text, marginTop: 8, textAlign: "center" },
    permissionHint: { fontSize: 13, color: t.textMuted, textAlign: "center", marginBottom: 10 },
    primaryBtn: { paddingHorizontal: 24, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  });
