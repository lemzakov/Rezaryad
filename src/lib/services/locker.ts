/**
 * LockerService – integration with the external hardware/locker management webservice.
 *
 * The service URL is configured via the LOCKER_SERVICE_URL environment variable.
 *
 * Business logic for the battery-swap flow:
 *  1. findBatteryLocation(userId) – ask the external service where this user's
 *     battery is currently stored.
 *  2. openLocker(lockerId) – tell the external service to open a specific locker.
 *  3. performSwap(userId) – full swap sequence: locate battery → open that locker.
 *
 * All methods are intentionally stubbed: they log the call parameters and
 * return placeholder responses until the real API is integrated.
 */
export class LockerService {
  constructor(private readonly baseUrl: string) {}

  /**
   * Step 1: Determine which locker currently holds this user's battery.
   * Returns locker metadata, or null when no battery is found.
   */
  async findBatteryLocation(userId: string): Promise<{
    lockerId: string;
    lockerName: string;
    lockerAddress: string;
  } | null> {
    if (!this.baseUrl) {
      console.warn('[LockerService] LOCKER_SERVICE_URL is not configured – skipping findBatteryLocation');
      return null;
    }
    console.log('[LockerService] findBatteryLocation →', { userId, baseUrl: this.baseUrl });
    // TODO: replace stub with real API call when the external service is ready.
    // Example:
    // const resp = await fetch(`${this.baseUrl}/api/battery-location?user_id=${encodeURIComponent(userId)}`, {
    //   headers: { Authorization: `Bearer ${process.env.LOCKER_SERVICE_API_KEY}` },
    //   signal: AbortSignal.timeout(10000),
    // });
    // if (!resp.ok) return null;
    // const data = await resp.json();
    // return data?.locker ?? null;
    return null;
  }

  /**
   * Step 2: Send an open command to the external service for the given locker.
   */
  async openLocker(lockerId: string): Promise<{ success: boolean; message?: string }> {
    if (!this.baseUrl) {
      console.warn('[LockerService] LOCKER_SERVICE_URL is not configured – skipping openLocker');
      return { success: false, message: 'Service URL not configured' };
    }
    console.log('[LockerService] openLocker →', { lockerId, baseUrl: this.baseUrl });
    // TODO: replace stub with real API call when the external service is ready.
    // Example:
    // const resp = await fetch(`${this.baseUrl}/api/open-locker`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     Authorization: `Bearer ${process.env.LOCKER_SERVICE_API_KEY}`,
    //   },
    //   body: JSON.stringify({ locker_id: lockerId }),
    //   signal: AbortSignal.timeout(10000),
    // });
    // if (!resp.ok) return { success: false, message: 'Failed to open locker' };
    // return { success: true };
    return { success: false, message: 'Stub – not yet implemented' };
  }

  /**
   * Full swap sequence: locate the user's battery, then open that locker.
   * Returns a discriminated result so the caller can send the right message.
   */
  async performSwap(
    userId: string,
    scannedQrCode: string,
  ): Promise<
    | { outcome: 'battery_not_found' }
    | { outcome: 'locker_open_failed'; lockerName: string }
    | { outcome: 'success'; lockerName: string; lockerAddress: string }
    | { outcome: 'service_unavailable' }
  > {
    if (!this.baseUrl) {
      return { outcome: 'service_unavailable' };
    }

    console.log('[LockerService] performSwap →', { userId, scannedQrCode });
    // Step 1 – find battery
    const location = await this.findBatteryLocation(userId);
    if (!location) {
      return { outcome: 'battery_not_found' };
    }

    // Step 2 – open the locker where battery is stored
    const result = await this.openLocker(location.lockerId);
    if (!result.success) {
      return { outcome: 'locker_open_failed', lockerName: location.lockerName };
    }

    return {
      outcome: 'success',
      lockerName: location.lockerName,
      lockerAddress: location.lockerAddress,
    };
  }
}
