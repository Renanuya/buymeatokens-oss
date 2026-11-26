// Same preview image for X / Twitter cards.
import Image, { alt as ogAlt, generateStaticParams as ogParams, size as ogSize } from "./opengraph-image";

export const alt = ogAlt;
export const size = ogSize;
export const contentType = "image/png";
export const dynamicParams = false;
export const generateStaticParams = ogParams;
export default Image;
