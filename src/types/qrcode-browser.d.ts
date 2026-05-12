declare module "qrcode/lib/browser" {
  const QRCode: {
    toDataURL: (
      text: string,
      options?: { margin?: number; width?: number; errorCorrectionLevel?: "L" | "M" | "Q" | "H" }
    ) => Promise<string>;
    toCanvas: (canvas: HTMLCanvasElement, text: string, options?: any) => Promise<HTMLCanvasElement>;
    toString: (text: string, options?: any) => Promise<string>;
  };
  export default QRCode;
}
