declare module "bakong-khqr" {
  export const khqrData: {
    currency: { usd: number; khr: number };
    merchantType: { merchant: string; individual: string };
  };
  export class IndividualInfo {
    constructor(
      bakongAccountId: string,
      merchantName: string,
      merchantCity: string,
      optionalData?: Record<string, unknown>
    );
  }
  export class MerchantInfo {
    constructor(
      bakongAccountId: string,
      merchantName: string,
      merchantCity: string,
      merchantId: string | number,
      acquiringBank: string,
      optionalData?: Record<string, unknown>
    );
  }
  export class SourceInfo {
    constructor(appIconUrl: string, appName: string, appDeepLinkCallback: string);
  }
  export class BakongKHQR {
    constructor();
    generateIndividual(info: IndividualInfo): any;
    generateMerchant(info: MerchantInfo): any;
    static decode(qr: string): any;
    static verify(qr: string): { isValid: boolean };
    static checkBakongAccount(url: string, bakongID: string): Promise<any>;
  }
}
