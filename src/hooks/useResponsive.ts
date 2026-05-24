import { useWindowDimensions } from 'react-native';

const BASE_WIDTH = 390;

export default function useResponsive() {
  const { width, height } = useWindowDimensions();
  const scale = width / BASE_WIDTH;
  const isTablet = width >= 768;

  const wp = (percent: number) => (width * percent) / 100;
  const hp = (percent: number) => (height * percent) / 100;
  const fs = (size: number) => Math.round(size * scale);
  const sp = (size: number) => Math.round(size * Math.min(scale, 1.3));

  const columns = isTablet ? 3 : 2;
  const columnsWide = isTablet ? 4 : 2;
  const modalMaxWidth = isTablet ? wp(60) : undefined;
  const cardPadding = sp(14);
  const modalMaxHeight = isTablet ? '70%' : '80%';

  return { width, height, scale, isTablet, wp, hp, fs, sp, columns, columnsWide, modalMaxWidth, cardPadding, modalMaxHeight };
}
