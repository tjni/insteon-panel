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
  BrokenLink,
  fetchBrokenLinks,
} from "../data/config";
import { navigate } from "@ha/common/navigate";
import "@ha/components/ha-fab";
import { showConfirmationDialog } from "@ha/dialogs/generic/show-dialog-box";
import { toAddressId } from "tools/address-utils";
import "@ha/components/ha-button-menu";
import "@ha/components/ha-icon-button";
import type { ActionDetail } from "@material/mwc-list";
import "@ha/components/ha-icon-overflow-menu";
import {
  writeALDB,
  changeALDBRecord,
  ALDBRecord,
  loadALDB,
  resetALDB,
  aldbNewRecordSchema,
  createALDBRecord,
} from "../data/device";
import { showInsteonALDBRecordDialog } from "../device/aldb/show-dialog-insteon-aldb-record"


interface BrokenLinkRowData extends DataTableRowData {
  address: string;
  device_name: string;
  mem_addr: number;
  in_use: boolean;
  group: number;
  is_controller: boolean
  highwater: boolean;
  target: string;
  target_name: string;
  data1: number;
  data2: number;
  data3: number;
  status: [
    "missing_controller",
    "missing_responder",
    "missing_target",
    "found",
    "target_db_not_loaded"
  ]
}

@customElement("broken-links-panel")
export class BrokenLinksPanel extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ type: Object }) public insteon!: Insteon;

  @property({ type: Boolean }) public narrow = false;

  @state() private _broken_links: BrokenLink[] = [];

  @state() private _any_aldb_status_loading: boolean = false;

  private _refreshDevicesTimeoutHandle?: number;

  private _subscribed?: Promise<() => Promise<void>>;

  private _selected_device: string = "";

  public firstUpdated(changedProperties) {
    super.firstUpdated(changedProperties);

    if (!this.hass || !this.insteon) {
      navigate("/insteon");
    }
    this._subscribe();
  }

  private async _getBrokenLinks() {
    await fetchBrokenLinks(this.hass).then((broken_links) => {
      this._broken_links = broken_links;
    });
  }

  private _columns = memoizeOne(() =>{
    const columns: DataTableColumnContainer = {
      device_name: {
        title: this.insteon.localize("utils.broken_links.fields.device"),
        sortable: true,
        filterable: true,
        direction: "asc",
        width: "20%"
      },
      group: {
        title: this.insteon.localize("utils.broken_links.fields.group"),
        sortable: true,
        filterable: true,
        direction: "asc",
        width: "5%"
      },
      controller: {
        title: this.insteon.localize("aldb.fields.mode"),
        template: (record: BrokenLink) => {
          if (record.is_controller) {
            return html`${this.insteon.localize("aldb.mode.controller")}`;
          }
          return html`${this.insteon.localize("aldb.mode.responder")}`;
        },
        sortable: true,
        filterable: true,
        direction: "asc",
        width: "8%"
      },
      target_name: {
        title: this.insteon.localize("utils.broken_links.fields.target"),
        sortable: true,
        filterable: true,
        direction: "asc",
        width: "20%"
      },
      status: {
        title: this.insteon.localize("utils.broken_links.fields.status"),
        template: (record: BrokenLink) => {
          return html`${this.insteon.localize("utils.broken_links.status." + record.status)}`;
        },
        sortable: true,
        filterable: true,
        direction: "asc",
        width: "15%"
      },
      recommneation: {
        title: this.insteon.localize("utils.broken_links.fields.recommendation"),
        template: (record: BrokenLink) => {
          return html`${this.insteon.localize("utils.broken_links.actions." + record.status)}`;
        },
        sortable: true,
        filterable: true,
        direction: "asc",
        width: "15%"
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
              label: this.insteon.localize("utils.broken_links.actions.target_db_not_loaded"),
              action: () => this._handleReloadAldb(record),
            },
            {
              path: mdiInformationOutline,
              label: this.insteon.localize("utils.broken_links.actions.missing_responder"),
              action: () => this._handleDeleteRecord(record),
            },
            {
              path: mdiInformationOutline,
              label: this.insteon.localize("utils.broken_links.actions.missing_controller"),
              action: () => this._handleCreateRecord(record),
            },
          ]}
        >
        </ha-icon-overflow-menu>
      `,
      }
    }
    return columns;
  });

  private _insteonBrokenLinks = memoizeOne(
    (broken_links: BrokenLink[]) => {
      if (!broken_links || this._any_aldb_status_loading) {
        return [];
      }
      const broken_link_list: BrokenLinkRowData[] = broken_links.map((broken_link) => {
        const linkRowData: BrokenLinkRowData = {
          address: broken_link.address,
          device_name: broken_link.device_name,
          mem_addr: broken_link.mem_addr,
          in_use: broken_link.in_use,
          is_controller: broken_link.is_controller,
          highwater: broken_link.highwater,
          group: broken_link.group,
          target: broken_link.target,
          target_name: broken_link.target_name,
          data1: broken_link.data1,
          data2: broken_link.data2,
          data3: broken_link.data3,
          status: broken_link.status,
        };
        return linkRowData;
      });
      return broken_link_list;
    },
  );

  private async _handleReloadAldb(record: BrokenLinkRowData) {
    showConfirmationDialog(this, {
      title: "Reload All-Link Database",
      text: this.insteon.localize("utils.broken_links.load_aldb") + record.device_name + this.insteon.localize("utils.broken_links.load_aldb_1"),
      confirm: async () => await loadALDB(this.hass, record.target),
    })

  }

  private async _handleDeleteRecord(record: BrokenLinkRowData) {
    const aldb_record: ALDBRecord = {
      mem_addr: record.mem_addr,
      in_use: false,
      is_controller: record.is_controller,
      highwater: record.highwater,
      group: record.group,
      target: record.target,
      target_name: record.target_name,
      data1: record.data1,
      data2: record.data2,
      data3: record.data3,
      dirty: true
    }
    await changeALDBRecord(this.hass, record.address, aldb_record);
    showConfirmationDialog(this, {
      title: "Delete record",
      text: this.insteon.localize("utils.broken_links.remove_record") + record.device_name,
      confirm: async () => await writeALDB(this.hass, record.address),
      cancel: async () => await resetALDB(this.hass, record.address)
    })

  }

  private async _handleCreateRecord(record: BrokenLinkRowData) {
    const aldb_rec: ALDBRecord = {
      mem_addr: 0,
      in_use: true,
      is_controller: !record.is_controller,
      highwater: false,
      group: record.group,
      target: record.address,
      target_name: "",
      data1: 255,
      data2: 0,
      data3: 1,
      dirty: true,
    };
    this._selected_device = record.target
    showInsteonALDBRecordDialog(this, {
      hass: this.hass,
      insteon: this.insteon,
      schema: aldbNewRecordSchema(this.insteon),
      record: aldb_rec,
      title: this.insteon.localize("aldb.actions.new"),
      require_change: false,
      callback: async (aldb_rec) => this._handleRecordCreate(aldb_rec),
    });
  }

  private async _handleRecordCreate(rec: ALDBRecord) {
    await createALDBRecord(this.hass, this._selected_device, rec);
    await writeALDB(this.hass, this._selected_device)
    this._selected_device = "";
  }

  protected render(): TemplateResult | void {
    return html`
      <hass-tabs-subpage-data-table
        .hass=${this.hass}
        .narrow=${this.narrow}
        .data=${this._insteonBrokenLinks(this._broken_links)}
        .columns=${this._columns()}
        .localizeFunc=${this.insteon.localize}
        .mainPage=${false}
        .hasFab=${false}
        .tabs=${[
          {
            translationKey: "utils.broken_links.caption",
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
        this._getBrokenLinks()
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
    "broken-links-panel": BrokenLinksPanel;
  }
}
