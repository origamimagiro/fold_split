import { NOTE } from "./flatfolder/note.js";
import { SVG } from "./flatfolder/svg.js";

window.onload = () => { MAIN.startup(); };  // entry point

const MAIN = {
    color: {
        background: "lightgray",
        edge: {
            U: "black",
            F: "gray",
            M: "red",
            V: "blue",
            B: "black",
        },
        rand: ["yellow", "lime", "aqua", "orange", "pink",
            "purple", "brown", "darkviolet", "teal", "olivedrab", "fuchsia",
            "deepskyblue", "orangered", "maroon", "yellow"],
    },
    startup: () => {
        NOTE.clear_log();
        NOTE.start("*** Starting Flat-Folder ***");
        NOTE.time("Initializing interface");
        const main = document.getElementById("main");
        for (const [k, v] of Object.entries({
            xmlns: SVG.NS,
            style: `background: ${MAIN.color.background}`,
            width: "100%",
        })) {
            main.setAttribute(k, v);
        }
        document.getElementById("import").onchange = (e) => {
            if (e.target.files.length > 0) {
                const file_reader = new FileReader();
                file_reader.onload = MAIN.process_file;
                file_reader.readAsText(e.target.files[0]);
            }
        };
    },
    process_file: (e) => {
        NOTE.clear_log();
        NOTE.start("*** Starting File Import ***");
        const doc = e.target.result;
        const file_name = document.getElementById("import").value;
        const parts = file_name.split(".");
        const type = parts[parts.length - 1].toLowerCase();
        if (type != "fold") {
            NOTE.time(`Found file with extension ${type}, FOLD format required`);
            return;
        }
        NOTE.time(`Importing from file ${file_name}`);
        const FOLD = JSON.parse(doc);
        const V = FOLD.vertices_coords;
        if (V == undefined) {
            NOTE.time("Invalid: FOLD file missing 'vertices_coords'");
            return;
        }
        const EV = FOLD.edges_vertices;
        if (EV == undefined) {
            NOTE.time("Invalid: FOLD file missing 'edges_vertices'");
            return;
        }
        const EA = FOLD.edges_assignment;
        if (EA == undefined) {
            NOTE.time("Invalid: FOLD file missing 'edges_assignment'");
            return;
        }
        let [min_x, min_y, max_x, max_y] = [Infinity, Infinity, -Infinity, -Infinity];
        for (const [x, y] of V) {
            if (x < min_x) { min_x = x; }
            if (y < min_y) { min_y = y; }
            if (x > max_x) { max_x = x; }
            if (y > max_y) { max_y = y; }
        }
        const w = max_x - min_x;
        const h = max_y - min_y;
        const pad = Math.floor(Math.min(w, h)/20);
        SVG.SCALE = 1;
        const main = SVG.clear("main");
        main.setAttribute("viewBox",
            [min_x - pad, min_y - pad, w + 2*pad, h + 2*pad].join(" "));
        // Construct components
        const VV = Array(V.length).fill(0).map(() => []);
        for (let i = 0; i < EV.length; ++i) {
            const [a, b] = EV[i];
            VV[a].push([b, i]);
            VV[b].push([a, i]);
        }
        const VC = Array(V.length).fill(undefined);
        let cn = 0;
        for (let s = 0; s < V.length; ++s) {
            if (VC[s] != undefined) { continue; }
            VC[s] = cn;
            const Q = [s];
            let i = 0;
            while (i < Q.length) {
                const vi = Q[i];
                ++i;
                const Adj = VV[vi];
                for (let j = 0; j < Adj.length; ++j) {
                    const [vj, ei] = Adj[j];
                    if (VC[vj] != undefined) { continue; }
                    VC[vj] = cn;
                    Q.push(vj);
                }
            }
            ++cn;
        }
        if (cn == 0) { return; }
        const FS = [];
        for (let ci = 0; ci < cn; ++ci) {
            const M = Array(V.length).fill(undefined);
            const vertices_coords = [];
            for (let vi = 0; vi < V.length; ++vi) {
                if (VC[vi] != ci) { continue; }
                M[vi] = vertices_coords.length;
                vertices_coords.push(V[vi]);
            }
            const edges_vertices = [];
            const edges_assignment = [];
            for (let ei = 0; ei < EV.length; ++ei) {
                const [vi, vj] = EV[ei];
                if (VC[vi] != ci) { continue; }
                edges_vertices.push([M[vi], M[vj]]);
                edges_assignment.push(EA[ei]);
            }
            FS.push({vertices_coords, edges_vertices, edges_assignment});
        }
        const C = MAIN.color.rand;
        for (let i = 0; i < cn; ++i) {
            const F = FS[i];
            const v = F.vertices_coords;
            const ev = F.edges_vertices;
            const ea = F.edges_assignment;
            const S = ev.map(([i, j]) => [v[i], v[j]]);
            const H = SVG.append("g", main, {id: `h_${i}`});
            SVG.draw_segments(H, S, {
                stroke: C[i % C.length], stroke_width: 5});
            const D = SVG.append("g", main, {id: `d_${i}`});
            SVG.draw_segments(D, S, {
                stroke: ea.map(a => MAIN.color.edge[a])});
        }
        document.getElementById("output").style.display = "inline";
        const select = SVG.clear("component");
        for (let i = 0; i < cn; ++i) {
            const el = document.createElement("option");
            el.setAttribute("value", `${i}`);
            el.textContent = `${i}`;
            select.appendChild(el);
        }
        FS.active = 0;
        select.onchange = () => MAIN.update_component(FS);
        MAIN.update_component(FS);
    },
    update_component: (FS) => {
        const C = MAIN.color.rand;
        const select = document.getElementById("component");
        const ci = +select.value;
        const g_old = document.getElementById(`h_${FS.active}`);
        console.log(FS.active, g_old.children);
        for (const el of g_old.children) {
            el.setAttribute("stroke-width", 5);
        }
        FS.active = ci;
        const g_new = document.getElementById(`h_${FS.active}`);
        for (const el of g_new.children) {
            el.setAttribute("stroke-width", 20);
        }
        select.style.background = C[ci % C.length];
        MAIN.write(FS, ci);
    },
    write: (FS, i) => {
        const {vertices_coords, edges_vertices, edges_assignment} = FS[i];
        const path = document.getElementById("import").value.split("\\");
        const name = path[path.length - 1].split(".")[0];
        const export_FOLD = {
            file_spec: 1.1,
            file_creator: "fold-split",
            file_title: `${name}_${i}`,
            file_classes: ["singleModel"],
            vertices_coords,
            edges_vertices,
            edges_assignment,
        };
        const data = new Blob([JSON.stringify(export_FOLD, undefined, 2)], {
            type: "application/json"});
        const link = document.getElementById("export_link");
        link.setAttribute("download", `${name}_${i}.fold`);
        link.setAttribute("href", window.URL.createObjectURL(data));
        link.style.textDecoration = "none";
    },
};
