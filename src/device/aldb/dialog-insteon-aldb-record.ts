import { css, CSSResultGroup, html, LitElement, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators";
import "@ha/components/ha-code-editor";
import { createCloseHeading } from "@ha/components/ha-dialog";
import { haStyleDialog } from "@ha/resources/styles";
import { HomeAssistant } from "@ha/types";
import { Insteon } from "../../data/insteon";
import { ALDBRecord } from "../../data/device";
import "./insteon-aldb-data-table";
import { checkAddress } from "../../tools/address-utils";
import "@ha/components/ha-form/ha-form";
import type { HaFormSchema, HaFormData } from "@ha/components/ha-form/types";
import { InsteonALDBRecordDialogParams } from "./show-dialog-insteon-aldb-record";

@customElement("dialog-insteon-aldb-record")
class DialogInsteonALDBRecord extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: false }) public insteon!: Insteon;

  @property({ type: Boolean }) public isWide?: boolean;

  @property({ type: Boolean }) public narrow?: boolean;

  @state() private _record?: ALDBRecord;

  @state() private _schema?: HaFormSchema[];

  @state() private _title?: string;

  @state() private _callback?: (record: ALDBRecord) => Promise<void>;

  @state() private _errors?: { [key: string]: string };

  @state() private _formData?: { [key: string]: any };

  @state() private _opened = false;

  private _require_change = true;

  public async showDialog(params: InsteonALDBRecordDialogParams): Promise<void> {
    this.hass = params.hass;
    this.insteon = params.insteon;
    this._record = params.record;
    this._formData = { ...params.record };
    this._formData!.mode = this._currentMode();
    this._schema = params.schema;
    this._callback = params.callback;
    this._title = params.title;
    this._errors = {};
    this._opened = true;
    this._require_change = params.require_change;
  }

  protected render(): TemplateResult {
    if (!this._opened) {
      return html``;
    }
    return html`
      <ha-dialog
        open
        @closed="${this._close}"
        .heading=${createCloseHeading(this.hass, this._title!)}
      >
        <div class="form">
          <ha-form
            .data=${this._haFormData()}
            .schema=${this._schema!}
            .error=${this._errors}
            @value-changed=${this._valueChanged}
          ></ha-form>
        </div>
        <div class="buttons">
          <mwc-button @click=${this._dismiss} slot="secondaryAction">
            ${this.hass.localize("ui.dialogs.generic.cancel")}
          </mwc-button>
          <mwc-button @click=${this._submit} slot="primaryAction">
            ${this.hass.localize("ui.dialogs.generic.ok")}
          </mwc-button>
        </div>
      </ha-dialog>
    `;
  }

  private _haFormData(): HaFormData {
    return {...this._formData}
  }

  private _dismiss(): void {
    this._close();
  }

  private async _submit(): Promise<void> {
    if (!this._changeMade() && this._require_change) {
      this._close();
      return;
    }
    if (this._checkData()) {
      const record = this._record;
      record!.mem_addr = this._formData!.mem_addr;
      record!.in_use = this._formData!.in_use;
      record!.target = this._formData!.target;
      record!.is_controller = this._updatedMode();
      record!.group = this._formData!.group;
      record!.data1 = this._formData!.data1;
      record!.data2 = this._formData!.data2;
      record!.data3 = this._formData!.data3;
      record!.highwater = false;
      record!.dirty = true;
      this._close();
      await this._callback!(record!);
    } else {
      this._errors!.base = this.insteon.localize("common.error.base");
    }
  }

  private _changeMade(): boolean {
    return (
      this._record!.in_use !== (this._formData!.in_use as boolean) ||
      this._currentMode() !== (this._formData!.mode as string) ||
      this._record!.target !== (this._formData!.target as string) ||
      this._record!.group !== (this._formData!.group as number) ||
      this._record!.data1 !== (this._formData!.data1 as number) ||
      this._record!.data2 !== (this._formData!.data2 as number) ||
      this._record!.data3 !== (this._formData!.data3 as number)
    );
  }

  private _close(): void {
    this._opened = false;
  }

  private _currentMode(): string {
    if (this._record!.is_controller) {
      return "c";
    }
    return "r";
  }

  private _updatedMode(): boolean {
    return this._formData!.mode === "c";
  }

  private _valueChanged(ev: CustomEvent) {
    this._formData = ev.detail.value;
  }

  private _checkData(): boolean {
    let success = true;
    this._errors = {};
    if (!checkAddress(this._formData!.target)) {
      if (!this.insteon) {
        // eslint-disable-next-line no-console
        console.info("This should NOT show up");
      }
      this._errors.target = this.insteon!.localize("common.error.address");
      success = false;
    }
    return success;
  }

  static get styles(): CSSResultGroup[] {
    return [
      haStyleDialog,
      css`
        table {
          width: 100%;
        }
        ha-combo-box {
          width: 20px;
        }
        .title {
          width: 200px;
        }
      `,
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "dialog-insteon-aldb-record": DialogInsteonALDBRecord;
  }
}
