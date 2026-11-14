import chart from '../assets/covers/desk-chart.jpg';
import lamp from '../assets/covers/desk-lamp.jpg';
import orb from '../assets/covers/desk-orb.jpg';
import pencils from '../assets/covers/desk-pencils.jpg';

const PLATES = [pencils, orb, chart, lamp];

export function coverFor(slug: string, coverUrl?: string | null) {
  if (coverUrl) return coverUrl;
  let index = 0;
  for (const char of slug) index = (index + char.charCodeAt(0)) % PLATES.length;
  return PLATES[index] || PLATES[0];
}
