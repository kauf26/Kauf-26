import type { OtpHandler, OtpRequest, OtpResolution } from "./types";
import { LocalizationWrapper } from "./localization";
import { LocaleKey } from "./localeKeys";

/**
 * Placeholder 2FA / OTP handler.
 * Wire TOTP secrets, manual prompts, or injected codes from your app layer.
 */
export class DefaultOtpHandler implements OtpHandler {
  async resolve(request: OtpRequest, resolution: OtpResolution): Promise<void> {
    const { page, marketplaceId } = request;
    const i18n = new LocalizationWrapper(page);

    let code: string;

    switch (resolution.type) {
      case "totp":
        code = await this.generateTotp(resolution.secret);
        break;
      case "inject":
        code = resolution.code;
        break;
      case "manual":
        code = await resolution.waitForCode();
        break;
      default:
        throw new Error(`Unsupported OTP resolution for ${marketplaceId}`);
    }

    await i18n.fillLabeledField(LocaleKey.VERIFY_CODE, code);
    await i18n.clickByKey(LocaleKey.SUBMIT, { role: "button" });
  }

  /**
   * Replace with `otplib` / `@levminer/speakeasy` in production.
   */
  private async generateTotp(_secret: string): Promise<string> {
    throw new Error(
      "TOTP not configured — install otplib and implement generateTotp(), " +
        "or use OtpResolution type 'manual' | 'inject'."
    );
  }
}
