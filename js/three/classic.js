/*
 * Тема «Классика»: объёмные фигуры Стаунтона из слоновой кости и эбенового дерева под лаком,
 * доска из клёна и ореха с золотыми координатами.
 */
(function () {
    'use strict';
    const CM = window.CM;
    const T = THREE;
    const { profile, lathe, deform, extrude } = CM.G;
    const { mesh } = CM;

    function materials(color) {
        if (color === 'w') {
            return {
                body: new T.MeshPhysicalMaterial({
                    color: '#e6d6b6', roughness: 0.4, metalness: 0,
                    clearcoat: 0.55, clearcoatRoughness: 0.22
                }),
                detail: new T.MeshStandardMaterial({ color: '#4a3524', roughness: 0.5 })
            };
        }
        return {
            body: new T.MeshPhysicalMaterial({
                color: '#2a1d15', roughness: 0.28, metalness: 0,
                clearcoat: 1, clearcoatRoughness: 0.1
            }),
            detail: new T.MeshStandardMaterial({ color: '#0d0907', roughness: 0.4 })
        };
    }
    const MATS = { w: materials('w'), b: materials('b') };

    // Общее основание всех фигур: широкий диск с двумя «ступенями»
    function baseCmds(r) {
        return [
            ['M', 0, 0],
            ['L', r - 0.01, 0],
            ['Q', r + 0.006, 0.004, r + 0.004, 0.028],
            ['Q', r + 0.008, 0.062, r - 0.026, 0.072],
            ['L', r - 0.045, 0.078],
            ['Q', r - 0.03, 0.098, r - 0.055, 0.108],
            ['L', r - 0.075, 0.114]
        ];
    }

    const PROFILES = {
        p: () => profile(baseCmds(0.27).concat([
            ['C', 0.15, 0.14, 0.1, 0.26, 0.095, 0.34],
            ['L', 0.098, 0.35],
            ['Q', 0.158, 0.352, 0.162, 0.372],
            ['Q', 0.166, 0.394, 0.1, 0.402],
            ['L', 0.078, 0.41],
            ['A', 0, 0.505, 0.118, -54, 90]
        ])),
        r: () => profile(baseCmds(0.3).concat([
            ['C', 0.19, 0.2, 0.172, 0.36, 0.176, 0.47],
            ['Q', 0.18, 0.5, 0.212, 0.51],
            ['Q', 0.236, 0.516, 0.234, 0.54],
            ['L', 0.236, 0.64],
            ['L', 0.17, 0.64],
            ['L', 0.17, 0.605],
            ['L', 0, 0.605]
        ])),
        b: () => profile(baseCmds(0.285).concat([
            ['C', 0.16, 0.15, 0.1, 0.34, 0.09, 0.47],
            ['L', 0.094, 0.48],
            ['Q', 0.16, 0.482, 0.162, 0.503],
            ['Q', 0.164, 0.526, 0.1, 0.532],
            ['L', 0.078, 0.54],
            ['C', 0.15, 0.585, 0.155, 0.7, 0.042, 0.795],
            ['L', 0.03, 0.8],
            ['A', 0, 0.835, 0.043, -45, 90]
        ])),
        q: () => profile(baseCmds(0.315).concat([
            ['C', 0.17, 0.17, 0.1, 0.42, 0.098, 0.56],
            ['L', 0.1, 0.57],
            ['Q', 0.172, 0.572, 0.175, 0.595],
            ['Q', 0.178, 0.62, 0.105, 0.628],
            ['L', 0.098, 0.64],
            ['C', 0.12, 0.72, 0.19, 0.8, 0.205, 0.86],
            ['L', 0.198, 0.88],
            ['Q', 0.16, 0.885, 0.13, 0.89],
            ['Q', 0.06, 0.93, 0.045, 0.96],
            ['A', 0, 0.99, 0.05, -40, 90]
        ])),
        k: () => profile(baseCmds(0.33).concat([
            ['C', 0.18, 0.18, 0.11, 0.44, 0.106, 0.6],
            ['L', 0.108, 0.61],
            ['Q', 0.182, 0.612, 0.186, 0.636],
            ['Q', 0.19, 0.662, 0.112, 0.67],
            ['L', 0.104, 0.68],
            ['C', 0.13, 0.76, 0.19, 0.83, 0.198, 0.875],
            ['Q', 0.206, 0.895, 0.19, 0.905],
            ['L', 0.12, 0.915],
            ['Q', 0.1, 0.95, 0.06, 0.962],
            ['L', 0.058, 0.985],
            ['Q', 0.068, 0.99, 0.066, 1.0],
            ['L', 0, 1.0]
        ]))
    };

    function knightShape() {
        // Голова коня в профиль, морда смотрит в сторону −x
        const s = new T.Shape();
        s.moveTo(0.2, 0.1);
        s.bezierCurveTo(0.25, 0.26, 0.24, 0.44, 0.18, 0.58);
        s.bezierCurveTo(0.15, 0.66, 0.11, 0.71, 0.08, 0.745);
        s.lineTo(0.098, 0.84);   // кончик уха
        s.bezierCurveTo(0.06, 0.82, 0.03, 0.79, 0.012, 0.76);
        s.bezierCurveTo(-0.05, 0.75, -0.1, 0.72, -0.14, 0.66);
        s.bezierCurveTo(-0.19, 0.6, -0.245, 0.53, -0.272, 0.47);
        s.bezierCurveTo(-0.29, 0.43, -0.285, 0.395, -0.255, 0.385);
        s.bezierCurveTo(-0.22, 0.375, -0.19, 0.39, -0.15, 0.41);
        s.bezierCurveTo(-0.11, 0.425, -0.08, 0.42, -0.06, 0.4);
        s.bezierCurveTo(-0.1, 0.33, -0.15, 0.24, -0.16, 0.1);
        s.lineTo(0.2, 0.1);
        return s;
    }

    function maneShape() {
        const s = new T.Shape();
        s.moveTo(0.215, 0.14);
        s.bezierCurveTo(0.27, 0.3, 0.26, 0.48, 0.2, 0.6);
        s.bezierCurveTo(0.17, 0.67, 0.13, 0.72, 0.09, 0.75);
        s.lineTo(0.07, 0.72);
        s.bezierCurveTo(0.12, 0.66, 0.2, 0.52, 0.2, 0.34);
        s.lineTo(0.18, 0.14);
        return s;
    }

    function buildKnight(m) {
        const g = new T.Group();
        const basePts = profile(baseCmds(0.3).concat([
            ['Q', 0.2, 0.13, 0.19, 0.15],
            ['L', 0, 0.15]
        ]));
        g.add(mesh(lathe(basePts, 40), m.body));

        const head = extrude(knightShape(), 0.1, 0.065, 7, 40);
        // «Лепим» объём: морда уже, шея и грудь шире
        deform(head, (v) => {
            const muzzle = Math.min(1, Math.max(0, (-v.x - 0.05) / 0.22));
            const low = Math.min(1, Math.max(0, (0.34 - v.y) / 0.24));
            const k = 1 - 0.34 * muzzle + 0.28 * low;
            v.z *= k;
        });
        g.add(mesh(head, m.body, 0, 0.04, 0));

        // Грива — узкий гребень вдоль шеи
        const mane = extrude(maneShape(), 0.07, 0.025, 4, 24);
        g.add(mesh(mane, m.body, 0.018, 0.04, 0));

        // Глаза и ноздри лежат на поверхности щёк
        const eyeGeo = new T.SphereGeometry(0.026, 16, 12);
        const nostrilGeo = new T.SphereGeometry(0.016, 12, 10);
        for (const z of [-1, 1]) {
            g.add(mesh(eyeGeo, m.detail, -0.07, 0.675, z * 0.105, { s: [1, 0.75, 0.45] }));
            g.add(mesh(nostrilGeo, m.detail, -0.262, 0.47, z * 0.062, { s: [1, 1, 0.5] }));
        }
        return g;
    }

    function buildRook(m) {
        const g = new T.Group();
        g.add(mesh(lathe(PROFILES.r(), 44), m.body));
        // Зубцы башни — сегменты кольца
        const merlonPts = profile([['M', 0.17, 0.635], ['L', 0.236, 0.635], ['L', 0.236, 0.71], ['L', 0.17, 0.71], ['L', 0.17, 0.635]], 2);
        const n = 6;
        for (let i = 0; i < n; i++) {
            const geo = lathe(merlonPts, 10, (i / n) * Math.PI * 2 + 0.12, (Math.PI * 2 / n) * 0.62);
            g.add(mesh(geo, m.body));
        }
        return g;
    }

    function buildBishop(m) {
        const g = new T.Group();
        g.add(mesh(lathe(PROFILES.b(), 44), m.body));
        // Прорезь митры — тонкая тёмная бороздка наискосок
        const slit = new T.BoxGeometry(0.012, 0.12, 0.262);
        g.add(mesh(slit, m.detail, 0.02, 0.705, 0, { rz: -0.75, ry: -0.5 }));
        return g;
    }

    function buildQueen(m) {
        const g = new T.Group();
        g.add(mesh(lathe(PROFILES.q(), 44), m.body));
        const ball = new T.SphereGeometry(0.03, 16, 12);
        const n = 9;
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            g.add(mesh(ball, m.body, Math.cos(a) * 0.19, 0.895, Math.sin(a) * 0.19));
        }
        return g;
    }

    function buildKing(m) {
        const g = new T.Group();
        g.add(mesh(lathe(PROFILES.k(), 44), m.body));
        const v = CM.G.roundedBox(0.055, 0.2, 0.055, 0.012, 3);
        const h = CM.G.roundedBox(0.16, 0.055, 0.055, 0.012, 3);
        g.add(mesh(v, m.body, 0, 1.09, 0));
        g.add(mesh(h, m.body, 0, 1.11, 0));
        return g;
    }

    function buildPiece(type, color) {
        const m = MATS[color];
        let g;
        switch (type) {
            case 'p': g = new T.Group(); g.add(mesh(lathe(PROFILES.p(), 40), m.body)); break;
            case 'r': g = buildRook(m); break;
            case 'n': g = buildKnight(m); break;
            case 'b': g = buildBishop(m); break;
            case 'q': g = buildQueen(m); break;
            default: g = buildKing(m);
        }
        const scale = 1.0;
        g.scale.setScalar(scale);
        CM.optimize(g);
        const box = new T.Box3().setFromObject(g);
        g.userData.height = box.max.y;
        g.userData.radius = 0.33;
        return g;
    }

    CM.Themes3D.classic = {
        key: 'classic',
        buildPiece,
        motion: 'glide',
        // Кони (морда модели смотрит в −x) повернуты в профиль к зрителю и к сопернику
        yaw(type, color) {
            if (type !== 'n') return 0;
            return color === 'w' ? -0.5 : Math.PI - 0.5;
        },
        yawOffset: 0,
        elevation: 54,
        fitHeight: 1.2,
        faceCamera: false
    };
})();
