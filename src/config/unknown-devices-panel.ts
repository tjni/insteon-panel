import {mdiInformationOutline } from "@mdi/js";
import { LitElement, html, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators";
import memoizeOne from "memoize-one";
import { DataTableRowData, DataTableColumnContainer } from "@ha/components/data-table/ha-data-table";
import "@ha/layouts/hass-tabs-subpage-data-table"
import "@ha/components/data-table/ha-data-table";
import "@ha/components/ha-fab";
import "@ha/components/ha-card";
import "@ha/components/ha-button-menu";
import "@ha/layouts/hass-tabs-subpage-data-table";
import { HomeAssistant } from "@ha/types";
import { Insteon } from "../data/insteon";
import {
  UnknownDevice,
  fetchUnknownDevices,
} from "../data/config";
import { navigate } from "@ha/common/navigate";
import "@ha/components/ha-fab";
import { showConfirmationDialog } from "@ha/dialogs/generic/show-dialog-box";
import { toAddressId } from "tools/address-utils";
import "@ha/components/ha-button-menu";
import "@ha/components/ha-icon-button";
import type { ActionDetail } from "@material/mwc-list";
import "@ha/components/ha-icon-overflow-menu";
import {writeALDB, changeALDBRecord, ALDBRecord, loadALDB, resetALDB, removeInsteonDevice,} from "../data/device";
import { showInsteonAddingDeviceDialog } from "../device/show-dialog-adding-device";


interface UnknownDeviceRowData extends DataTableRowData {
  address: string;
}

@customElement("unknown-devices-panel")
export class UnknownDevicesPanel extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ type: Object }) public insteon!: Insteon;

  @property({ type: Boolean }) public narrow = false;

  @state() private _unknown_devices: string[] = [];

  @state() private _any_aldb_status_loading: boolean = false;

  private _refreshDevicesTimeoutHandle?: number;

  private _subscribed?: Promise<() => Promise<void>>;

  public firstUpdated(changedProperties) {
    super.firstUpdated(changedProperties);

    if (!this.hass || !this.insteon) {
      navigate("/insteon");
    }
    this._subscribe();
  }

  private async _getUnknownDevices() {
    await fetchUnknownDevices(this.hass).then((unknown_devices) => {
      this._unknown_devices = unknown_devices;
    });
  }

  private _columns = memoizeOne(() => {
    const columns: DataTableColumnContainer = {
      address: {
        title: this.insteon.localize("utils.unknown_devices.fields.address"),
        sortable: true,
        filterable: true,
        direction: "asc",
        grows: true,
      },
      actions: {
        title: "",
        width: this.narrow ? undefined : "5%",
        type: "overflow-menu",
        template: (record) => html`
        <ha-icon-overflow-menu
          .hass=${this.hass}
          narrow
          .items=${[
            {
              path: mdiInformationOutline,
              label: this.insteon.localize("utils.unknown_devices.actions.discover"),
              action: () => this._handleDiscoverDevice(record),
            },
            {
              path: mdiInformationOutline,
              label: this.insteon.localize("utils.unknown_devices.actions.delete"),
              action: () => this._handleDeleteDevice(record),
            },
          ]}
        >
        </ha-icon-overflow-menu>
      `,
      }
    }
    return columns;
  });

  private _insteonUnknownDevices = memoizeOne(
    (unknown_devices: string[]) => {
      if (!unknown_devices || this._any_aldb_status_loading) {
        return [];
      }
      const unknown_device_list: UnknownDeviceRowData[] = unknown_devices.map((unknown_device) => {
        const linkRowData: UnknownDeviceRowData = {
          address: unknown_device,
        };
        return linkRowData;
      });
      return unknown_device_list;
    },
  );

  private async _handleDiscoverDevice(record: UnknownDeviceRowData) {

    showInsteonAddingDeviceDialog(this, {
      hass: this.hass,
      insteon: this.insteon,
      multiple: false,
      address: record.address,
      title: this.insteon.localize("devices.adding_device"),
    });

    await this._getUnknownDevices()
  }

  private async _handleDeleteDevice(record: UnknownDeviceRowData) {
    const address = record.address;
    const confirm = await showConfirmationDialog(this, {
      text: this.insteon.localize("common.warn.delete"),
      confirmText: this.hass!.localize("ui.common.yes"),
      dismissText: this.hass!.localize("ui.common.no"),
      warning: true,
    });
    if (!confirm) {
      return;
    }
    const remove_all_refs = await showConfirmationDialog(this, {
      title: this.insteon.localize("device.remove_all_refs.title"),
      text: html`
        ${this.insteon.localize("device.remove_all_refs.description")}<br><br>
        ${this.insteon.localize("device.remove_all_refs.confirm_description")}<br>
        ${this.insteon.localize("device.remove_all_refs.dismiss_description")}`,
      confirmText: this.hass!.localize("ui.common.yes"),
      dismissText: this.hass!.localize("ui.common.no"),
      warning: true,
      destructive: true,
    });
    await removeInsteonDevice(this.hass, address, remove_all_refs);
    await this._getUnknownDevices()
  }

  protected render(): TemplateResult | void {
    return html`
      <hass-tabs-subpage-data-table
        .hass=${this.hass}
        .narrow=${this.narrow}
        .data=${this._insteonUnknownDevices(this._unknown_devices)}
        .columns=${this._columns()}
        .localizeFunc=${this.insteon.localize}
        .mainPage=${false}
        .hasFab=${false}
        .tabs=${[
          {
            translationKey: "utils.unknown_devices.caption",
            path: `/insteon`,
          },
        ]}
        .noDataText=${this._any_aldb_status_loading ? this.insteon.localize("utils.aldb_loading_long") : undefined}
        backPath="/insteon/utils"
      >
      </hass-tabs-subpage-data-table>
    `;
  }

  private _handleMessage(message: any): void {
    if (message.type === "status") {
      this._any_aldb_status_loading = message.is_loading;
      if (!this._any_aldb_status_loading) {
        this._getUnknownDevices()
      }
    }
  }

  private _unsubscribe(): void {
    if (this._refreshDevicesTimeoutHandle) {
      clearTimeout(this._refreshDevicesTimeoutHandle);
    }
    if (this._subscribed) {
      this._subscribed.then((unsub) => unsub());
      this._subscribed = undefined;
    }
  }

  private _subscribe(): void {
    if (!this.hass) {
      return;
    }
    this._subscribed = this.hass.connection.subscribeMessage(
      (message) => this._handleMessage(message),
      {
        type: "insteon/aldb/notify_all"
      },
    );
    this._refreshDevicesTimeoutHandle = window.setTimeout(
      () => this._unsubscribe(),
      1200000,
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "unknown-devices-panel": UnknownDevicesPanel;
  }
}
