/**
 * Fruits theme assets.
 *
 * Each PNG under `src/assets/themes/fruits/` is imported through Vite so it
 * flows through the build pipeline (hashed filename in `dist/assets/`, served
 * from the CDN in production).
 *
 * The matching game stores the canonical fruit key (e.g. `"banana"`) in
 * `CardData.iconName`. `Card.tsx` resolves the key to an image URL through
 * `FRUIT_IMAGES` at render time.
 */

import apple from './apple.png';
import avocado from './avocado.png';
import banana from './banana.png';
import carrot from './carrot.png';
import cherry from './cherry.png';
import coconut from './coconut.png';
import corn from './corn.png';
import cucumber from './cucumber.png';
import eggplant from './eggplant.png';
import grannysmith from './grannysmith.png';
import grapes from './grapes.png';
import kiwis from './kiwis.png';
import lemon from './lemon.png';
import lettuce from './lettuce.png';
import mango from './mango.png';
import melon from './melon.png';
import orange from './orange.png';
import peach from './peach.png';
import pear from './pear.png';
import pineapple from './pineapple.png';
import strawberry from './strawberry.png';
import tomato from './tomato.png';
import watermelon from './watermelon.png';

export const FRUIT_IMAGES: Record<string, string> = {
  apple,
  avocado,
  banana,
  carrot,
  cherry,
  coconut,
  corn,
  cucumber,
  eggplant,
  grannysmith,
  grapes,
  kiwis,
  lemon,
  lettuce,
  mango,
  melon,
  orange,
  peach,
  pear,
  pineapple,
  strawberry,
  tomato,
  watermelon
};

export const FRUIT_NAMES: readonly string[] = Object.keys(FRUIT_IMAGES);
