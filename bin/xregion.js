"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XRegion = void 0;
const os = require("os");
const fs = require("fs");
const path = require("path");
const xload_1 = require("./xload");
var XRegion;
(function (XRegion) {
    let JSONX;
    (function (JSONX) {
        JSONX.write_file = (stream, data) => {
            if (!stream || !data) {
                return false;
            }
            if (os.platform() == "win32") {
                stream.write(`\xEF\xBB\xBF`, "binary");
            }
            let text = JSON.stringify(data, null, "\t");
            stream.write(text);
            return true;
        };
    })(JSONX = XRegion.JSONX || (XRegion.JSONX = {}));
    let load_region_from_file = (mode, id, filename, data) => {
        if (id < 0 || !(data === null || data === void 0 ? void 0 : data.list) || !data.list[id]) {
            return false;
        }
        if (!fs.existsSync(filename)) {
            return false;
        }
        let result = xload_1.XLoadFile.load_from_file(mode, filename, { index: "id" });
        if (!result) {
            return false;
        }
        let cid = -1;
        result.list.forEach((v) => {
            cid = v.cid;
            delete v.cid;
        });
        if (cid != id) {
            return false;
        }
        data.list[id].list = result.list;
        return true;
    };
    XRegion.load_from_file = (mode, filename) => {
        let fullname = path.resolve(process.cwd(), filename);
        if (!fs.existsSync(fullname)) {
            return null;
        }
        let dirname = path.dirname(fullname);
        try {
            let data = xload_1.XLoadFile.load_from_file(mode, filename, { index: "id" });
            if (!data) {
                console.error("Error");
                return -1;
            }
            let files = fs.readdirSync(dirname);
            files = files.filter((v) => { return /^\d+-region/i.test(v); });
            for (let i = 0; i < files.length; i++) {
                let name = files[i];
                let tempname = path.resolve(process.cwd(), name);
                let id = (/^\d+/i.exec(name) || [-1])[0];
                load_region_from_file(mode, id, tempname, data);
            }
            return data;
        }
        catch (e) {
            return null;
        }
    };
    XRegion.save_to_file = (mode, data, filename) => {
        let fullname = path.resolve(process.cwd(), filename);
        try {
            let encoding = "utf8";
            let stream = fs.createWriteStream(fullname, { flags: 'w', encoding: encoding, });
            if (stream) {
                if (mode == "JSON") {
                    JSONX.write_file(stream, data);
                }
                else {
                }
                stream.close();
            }
            return true;
        }
        catch (e) {
            return false;
        }
    };
})(XRegion = exports.XRegion || (exports.XRegion = {}));
//# sourceMappingURL=xregion.js.map