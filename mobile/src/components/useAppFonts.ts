import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from "@expo-google-fonts/hanken-grotesk";
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
} from "@expo-google-fonts/ibm-plex-mono";
import {
  Literata_400Regular,
  Literata_400Regular_Italic,
  Literata_600SemiBold,
  Literata_700Bold,
} from "@expo-google-fonts/literata";
import { useFonts } from "expo-font";

import { FONTS } from "../theme/fonts";

const FONT_ASSETS = {
  [FONTS.prose]: Literata_400Regular,
  [FONTS.proseItalic]: Literata_400Regular_Italic,
  [FONTS.proseSemi]: Literata_600SemiBold,
  [FONTS.proseBold]: Literata_700Bold,
  [FONTS.ui]: HankenGrotesk_400Regular,
  [FONTS.uiMedium]: HankenGrotesk_500Medium,
  [FONTS.uiSemi]: HankenGrotesk_600SemiBold,
  [FONTS.uiBold]: HankenGrotesk_700Bold,
  [FONTS.mono]: IBMPlexMono_400Regular,
  [FONTS.monoMedium]: IBMPlexMono_500Medium,
};

export function useAppFonts(): boolean {
  const [loaded] = useFonts(FONT_ASSETS);
  return loaded;
}
