import { createElement, type CSSProperties } from 'react';

type Props = {
  src: string;
  trigger?: string;
  colors?: string;
  style?: CSSProperties;
};

export function LordIcon({ src, trigger, colors, style }: Props) {
  return createElement('lord-icon', { src, trigger, colors, style });
}
