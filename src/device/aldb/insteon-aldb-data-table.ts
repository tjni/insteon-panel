import { html, LitElement, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators";
import memoizeOne from "memoize-one";
import "@ha/components/ha-circular-progress";
import "@ha/components/data-table/ha-data-table";
import { DataTableColumnContainer, DataTableRowData } from "@ha/components/data-table/ha-data-table";
import { Insteon } from "../../data/insteon";
import { ALDBRecord } from "../../data/device";
import { HomeAssistant } from "@ha/types";
import { computeRTLDirection } from "@ha/common/util/compute_rtl";

export interface RecordRowData extends ALDBRecord {
  record?: ALDBRecord;
}

@customElement("insteon-aldb-data-table")
export class InsteonALDBDataTable extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: false }) public insteon!: Insteon;

  @property({ type: Boolean }) public narrow = false;

  @property({ attribute: false }) public records: ALDBRecord[] = [];

  @property({ type: Boolean }) public isLoading = false;

  @property({ type: Boolean }) public showWait = false;

  private _records = memoizeOne((records: ALDBRecord[]): DataTableRowData[] => {
    if (!records) {
      return [];
    }
    const outputRecords: RecordRowData[] = records;

    return outputRecords.map((record) => ({
      ...record,
    }));
  });

  private _columns = memoizeOne(
    (narrow: boolean): DataTableColumnContainer =>
      narrow
        ? {
            in_use: {
              title: this.insteon.localize("aldb.fields.in_use"),
              template: (record) => {
                if (record.in_use) {
                  return html`${this.hass.localize("ui.common.yes")}`;
                }
                return html`${this.hass.localize("ui.common.no")}`;
              },
              sortable: true,
              width: "15%",
            },
            dirty: {
              title: this.insteon.localize("aldb.fields.modified"),
              template: (record) => {
                if (record.dirty) {
                  return html`${this.hass.localize("ui.common.yes")}`;
                }
                return html`${this.hass.localize("ui.common.no")}`;
              },
              sortable: true,
              width: "15%",
            },
            target: {
              title: this.insteon.localize("aldb.fields.target"),
              sortable: true,
              grows: true,
            },
            group: {
              title: this.insteon.localize("aldb.fields.group"),
              sortable: true,
              width: "15%",
            },
            is_controller: {
              title: this.insteon.localize("aldb.fields.mode"),
              template: (record) => {
                if (record.is_controller) {
                  return html`${this.insteon.localize("aldb.mode.controller")}`;
                }
                return html`${this.insteon.localize("aldb.mode.responder")}`;
              },
              sortable: true,
              width: "25%",
            },
          }
        : {
            mem_addr: {
              title: this.insteon.localize("aldb.fields.id"),
              template: (record) => {
                if (record.mem_addr < 0) {
                  return html`New`;
                }
                return html`${record.mem_addr}`;
              },
              sortable: true,
              direction: "desc",
              width: "10%",
            },
            in_use: {
              title: this.insteon.localize("aldb.fields.in_use"),
              template: (record) => {
                if (record.in_use) {
                  return html`${this.hass.localize("ui.common.yes")}`;
                }
                return html`${this.hass.localize("ui.common.no")}`;
              },
              sortable: true,
              width: "10%",
            },
            dirty: {
              title: this.insteon.localize("aldb.fields.modified"),
              template: (record) => {
                if (record.dirty) {
                  return html`${this.hass.localize("ui.common.yes")}`;
                }
                return html`${this.hass.localize("ui.common.no")}`;
              },
              sortable: true,
              width: "10%",
            },
            target: {
              title: this.insteon.localize("aldb.fields.target"),
              sortable: true,
              width: "15%",
            },
            target_name: {
              title: this.insteon.localize("aldb.fields.target_device"),
              sortable: true,
              grows: true,
            },
            group: {
              title: this.insteon.localize("aldb.fields.group"),
              sortable: true,
              width: "10%",
            },
            is_controller: {
              title: this.insteon.localize("aldb.fields.mode"),
              template: (record) => {
                if (record.is_controller) {
                  return html`${this.insteon.localize("aldb.mode.controller")}`;
                }
                return html`${this.insteon.localize("aldb.mode.responder")}`;
              },
              sortable: true,
              width: "12%",
            },
          },
  );

  private _noDataText(loading): string {
    if (loading) {
      return "";
    }
    return this.insteon.localize("aldb.no_data");
  }

  protected render(): TemplateResult {
    if (this.showWait) {
      return html`
        <ha-circular-progress active alt="Loading"></ha-circular-progress>
      `;
    }
    return html`
      <ha-data-table
        .hass=${this.hass}
        .columns=${this._columns(this.narrow)}
        .data=${this._records(this.records)}
        .id=${"mem_addr"}
        .dir=${computeRTLDirection(this.hass)}
        .searchLabel=${this.hass.localize("ui.components.data-table.search")}
        .noDataText="${this._noDataText(this.isLoading)}"
      >
        <ha-circular-progress active alt="Loading"></ha-circular-progress>
      </ha-data-table>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "insteon-aldb-data-table": InsteonALDBDataTable;
  }
}
