import { describe, expect, it } from "vitest";
import { burnairMapUrl } from "./burnair";

describe("burnairMapUrl", () => {
  it("opens the burnair map at the place with the site layers on", () => {
    expect(burnairMapUrl(46.9467781, 8.5364441)).toBe(
      "https://map.burnair.cloud/?layers=tw%2Cant%2Calr%2Cald&visibility=on%2Con%2Con%2Con#15/46.94678/8.53644",
    );
    expect(burnairMapUrl(46.69, 7.83, 12)).toMatch(/#12\/46\.69000\/7\.83000$/);
  });
});
