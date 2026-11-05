/* Porta serial USB-CDC pela WebUSB, para navegadores sem Web Serial (ex.: Chrome do Android).
   Usa a interface de controle (classe 2) e a de dados (classe 0x0A) da placa. GPL-2.0-or-later. */
(function (root) {
  "use strict";
  const SET_LINE_CODING = 0x20,
    SET_CONTROL_LINE_STATE = 0x22;

  class LabCdcSerial {
    constructor(device) {
      this.device = device;
      this.opened = false;
    }
    static async request(filters, usb = navigator.usb) {
      return new LabCdcSerial(await usb.requestDevice({ filters }));
    }
    static async known(filters, usb = navigator.usb) {
      const device = (await usb.getDevices()).find((d) =>
        filters.some((f) => d.vendorId === f.vendorId && d.productId === f.productId),
      );
      return device ? new LabCdcSerial(device) : null;
    }

    async open(baudRate = 115200) {
      const d = this.device;
      if (!d.opened) await d.open();
      if (!d.configuration) await d.selectConfiguration(1);
      for (const iface of d.configuration.interfaces) {
        const alt = iface.alternates[0];
        if (alt.interfaceClass === 0x02 && alt.interfaceSubclass === 0x02)
          this.control = iface.interfaceNumber;
        if (alt.interfaceClass === 0x0a) {
          this.data = iface.interfaceNumber;
          this.epIn = alt.endpoints.find((e) => e.direction === "in" && e.type === "bulk");
          this.epOut = alt.endpoints.find((e) => e.direction === "out" && e.type === "bulk");
        }
      }
      if (this.control === undefined || !this.epIn || !this.epOut)
        throw new Error("Esta placa não tem porta serial USB (CDC).");
      try {
        await d.claimInterface(this.control);
        await d.claimInterface(this.data);
      } catch (error) {
        throw new Error(
          "O celular já está usando a porta serial da placa (" + error.message + "). Use um Chrome com Web Serial ou só o monitor.",
        );
      }
      // 8 bits, sem paridade, 1 stop
      const line = new DataView(new ArrayBuffer(7));
      line.setUint32(0, baudRate, true);
      line.setUint8(4, 0);
      line.setUint8(5, 0);
      line.setUint8(6, 8);
      await this._control(SET_LINE_CODING, 0, line);
      await this._control(SET_CONTROL_LINE_STATE, 0x03); // DTR e RTS
      this.opened = true;
    }
    _control(request, value, data) {
      const setup = { requestType: "class", recipient: "interface", request, value, index: this.control };
      return data ? this.device.controlTransferOut(setup, data) : this.device.controlTransferOut(setup);
    }
    async read() {
      const r = await this.device.transferIn(this.epIn.endpointNumber, Math.max(this.epIn.packetSize, 64));
      if (r.status !== "ok") throw new Error("Falha na leitura da serial USB: " + r.status);
      return new Uint8Array(r.data.buffer, r.data.byteOffset, r.data.byteLength);
    }
    async write(bytes) {
      const r = await this.device.transferOut(this.epOut.endpointNumber, bytes);
      if (r.status !== "ok") throw new Error("Falha no envio pela serial USB: " + r.status);
    }
    // Solta só as interfaces da serial; o depurador (ICDI) pode continuar usando o mesmo dispositivo.
    async close() {
      const d = this.device;
      this.opened = false;
      await this._control(SET_CONTROL_LINE_STATE, 0).catch(() => {});
      for (const n of [this.data, this.control])
        await d.releaseInterface(n).catch(() => {});
      if (d.opened && !d.configuration.interfaces.some((i) => i.claimed))
        await d.close().catch(() => {});
    }
  }
  root.LabCdcSerial = LabCdcSerial;
})(typeof globalThis !== "undefined" ? globalThis : window);
