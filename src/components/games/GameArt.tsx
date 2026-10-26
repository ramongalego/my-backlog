import Image from 'next/image';
import { isBoxArt } from '@/lib/igdb/images';

/**
 * A game's art filling its (positioned) parent. Wide art is cropped to fit;
 * tall box art, for games added by hand without wide artwork, sits whole in
 * the middle over a blurred, enlarged copy of itself, so it fills the frame
 * without losing its top and bottom.
 */
export function GameArt({
  src,
  alt,
  sizes,
  priority,
  quality,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  quality?: number;
}) {
  if (!isBoxArt(src)) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        quality={quality}
        className="object-cover"
        draggable={false}
      />
    );
  }
  return (
    <>
      <Image
        src={src}
        alt=""
        aria-hidden="true"
        fill
        // The same size as the art on top, so one download serves both and
        // the blur doesn't arrive after the art.
        sizes={sizes}
        priority={priority}
        quality={quality}
        className="object-cover scale-125 blur-xl brightness-75 saturate-150"
        draggable={false}
      />
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        quality={quality}
        className="object-contain"
        draggable={false}
      />
    </>
  );
}
