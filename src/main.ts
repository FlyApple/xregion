import "os";
import {XRegion} from "./xregion";


//
function main() {

    let data = XRegion.load_from_file("TXT", "./country.txt");
    if(!data) {
        console.error("Error");
        return -1;
    }

    XRegion.save_to_file("JSON", data, "./country.json");
    XRegion.save_to_file("TS", data, "./country.ts");
    return 0;
}


main();