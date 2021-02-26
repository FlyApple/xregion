"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("os");
const xregion_1 = require("./xregion");
function main() {
    let data = xregion_1.XRegion.load_from_file("TXT", "./country.txt");
    if (!data) {
        console.error("Error");
        return -1;
    }
    xregion_1.XRegion.save_to_file("JSON", data, "./country.json");
    return 0;
}
main();
//# sourceMappingURL=main.js.map