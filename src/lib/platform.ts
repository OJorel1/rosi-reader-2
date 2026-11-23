export const isAndroid = /Android/i.test(navigator.userAgent);
export const isLinux = !isAndroid && /Linux|X11/i.test(navigator.userAgent);
export const isNarrow = () => window.matchMedia("(max-width: 760px)").matches;
