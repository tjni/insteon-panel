import { customElement, property, state } from "lit/decorators";
import { mdiNetwork, mdiFolderMultipleOutline, mdiWrench } from "@mdi/js";
import {
  HassRouterPage,
  RouterOptions,
} from "@ha/layouts/hass-router-page";
import { PageNavigation } from "@ha/layouts/hass-tabs-subpage";
import { HomeAssistant, Route } from "@ha/types";
import { Insteon } from "./data/insteon";
import { unknown } from "superstruct";

export const insteonMainTabs: PageNavigation[] = [
  {
    translationKey: "devices.caption",
    path: `/insteon/devices`,
    iconPath: mdiFolderMultipleOutline,
  },
  {
    translationKey: "scenes.caption",
    path: `/insteon/scenes`,
    iconPath: mdiNetwork,
  },
  {
    translationKey: "utils.caption",
    path: `/insteon/utils`,
    iconPath: mdiWrench,
  },
];

@customElement("insteon-router")
class InsteonRouter extends HassRouterPage {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: false }) public insteon!: Insteon;

  @property({ attribute: false }) public route!: Route;

  @property({ type: Boolean }) public narrow!: boolean;

  @state() private _wideSidebar = false;

  @state() private _wide = false;

  protected routerOptions: RouterOptions = {
    defaultPage: "devices",
    routes: {
      device: {
        tag: "insteon-device-router",
        load: () => import("./device/insteon-device-router"),
      },
      devices: {
        tag: "insteon-devices-panel",
        load: () => import("./insteon-devices-panel"),
      },
      scene: {
        tag: "insteon-scene-editor",
        load: () => import("./scene/insteon-scene-editor"),
      },
      scenes: {
        tag: "insteon-scenes-panel",
        load: () => import("./insteon-scenes-panel"),
      },
      utils: {
        tag: "insteon-utils-panel",
        load: () => import("./insteon-utils-panel"),
      },
      device_overrides: {
        tag: "device-overrides-panel",
        load: () => import("./config/device-overrides-panel")
      },
      broken_links: {
        tag: "broken-links-panel",
        load: () => import("./config/broken-links-panel")
      },
      unknown_devices: {
        tag: "unknown-devices-panel",
        load: () => import("./config/unknown-devices-panel")
      }
    },
  };

  protected updatePageEl(el) {
    const section = this.route.path.replace("/", "");
    const isWide =
      this.hass.dockedSidebar === "docked" ? this._wideSidebar : this._wide;
    el.hass = this.hass;
    el.route = this.routeTail;
    el.narrow = this.narrow;
    el.isWide = isWide;
    el.section = section;

    if (this._currentPage == "device") {
      const routeSplit = this.routeTail.path.split("/");
      el.deviceId = routeSplit[routeSplit.length - 1];
    }

    if (this._currentPage == "scene") {
      const routeSplit = this.routeTail.path.split("/");
      el.sceneId = routeSplit[routeSplit.length - 1];
    }

    el.insteon = this.insteon;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "insteon-router": InsteonRouter;
  }
}
