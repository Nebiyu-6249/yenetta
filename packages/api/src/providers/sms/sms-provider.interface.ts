/** Pluggable SMS contract for OTP delivery (BUILD_BRIEF §3, §7). */

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

export interface SmsProvider {
  readonly name: string;
  sendOtp(phone: string, code: string): Promise<void>;
}
