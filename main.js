import * as THREE from './build/three.module.js';
import Stats from './build/stats.module.js';
import { GLTFLoader } from './build/GLTFLoader.js';
import { PMREMGenerator } from './build/PMREMGenerator.js';
import { DRACOLoader } from './build/DRACOLoader.js';
import { CarControls } from './build/CarControls.js';
import { PMREMCubeUVPacker } from './build/PMREMCubeUVPacker.js';

let camera, scene, renderer, stats, carModel, materialsLib, envMap;
let bodyMatSelect = document.getElementById('body-mat');
let rimMatSelect = document.getElementById('rim-mat');
let glassMatSelect = document.getElementById('glass-mat');
let followCamera = document.getElementById('camera-toggle');
let clock = new THREE.Clock();
let carControls = new CarControls();
carControls.turningRadius = 75;
let carParts = {
    body: [],
    rims: [],
    glass: [],
};
let damping = 5.0;
let distance = 5;
let cameraTarget = new THREE.Vector3();
let isDragging = false;
let previousMousePosition = {
    x: 0,
    y: 0
};
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

function init() {
    let container = document.getElementById('container');

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(3.25, 2.0, -5);
    camera.lookAt(0, 0.5, 0);

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xd7cbb1, 1, 80);

    let urls = ['px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg'];
    let loader = new THREE.CubeTextureLoader().setPath('textures/cube/skyboxsun25deg/');
    loader.load(urls, function (texture) {
        scene.background = texture;

        let pmremGenerator = new PMREMGenerator(renderer);
        envMap = pmremGenerator.fromCubemap(texture).texture;
        pmremGenerator.dispose();

        initCar();
        initMaterials();
        initMaterialSelectionMenus();
    });

    let ground = new THREE.Mesh(
        new THREE.PlaneGeometry(2400, 2400),
        new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.15, depthWrite: false })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.renderOrder = 1;
    scene.add(ground);

    let grid = new THREE.GridHelper(400, 40, 0x000000, 0x000000);
    grid.material.opacity = 0.2;
    grid.material.depthWrite = false;
    grid.material.transparent = true;
    scene.add(grid);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    stats = new Stats();
    container.appendChild(stats.dom);

    window.addEventListener('resize', onWindowResize, false);
    container.addEventListener('mousedown', onMouseDown, false);
    container.addEventListener('mouseup', onMouseUp, false);
    container.addEventListener('mousemove', onMouseMove, false);

    // Add touch events
    container.addEventListener('touchstart', onTouchStart, false);
    container.addEventListener('touchmove', onTouchMove, false);
    container.addEventListener('touchend', onTouchEnd, false);

    renderer.setAnimationLoop(function () {
        update();
        renderer.render(scene, camera);
    });
}

function initCar() {
    DRACOLoader.setDecoderPath('js/libs/draco/gltf/');
    let loader = new GLTFLoader();
    loader.setDRACOLoader(new DRACOLoader());
    loader.load('models/ferrari.glb', function (gltf) {
        carModel = gltf.scene.children[0];
        carControls.setModel(carModel);
        carModel.traverse(function (child) {
            if (child.isMesh) {
                child.material.envMap = envMap;
            }
        });

        let texture = new THREE.TextureLoader().load('models/ferrari_ao.png');
        let shadow = new THREE.Mesh(
            new THREE.PlaneGeometry(0.655 * 4, 1.3 * 4).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ map: texture, opacity: 0.8, transparent: true })
        );
        shadow.renderOrder = 2;
        carModel.add(shadow);
        scene.add(carModel);

        carParts.body.push(carModel.getObjectByName('body'));
        carParts.rims.push(
            carModel.getObjectByName('rim_fl'),
            carModel.getObjectByName('rim_fr'),
            carModel.getObjectByName('rim_rr'),
            carModel.getObjectByName('rim_rl'),
            carModel.getObjectByName('trim')
        );
        carParts.glass.push(
            carModel.getObjectByName('glass')
        );
        updateMaterials();
    });
}

function initMaterials() {
    materialsLib = {
        main: [
            new THREE.MeshStandardMaterial({ color: 0xff4400, envMap: envMap, metalness: 0.9, roughness: 0.2, name: 'orange' }),
            new THREE.MeshStandardMaterial({ color: 0x001166, envMap: envMap, metalness: 0.9, roughness: 0.2, name: 'blue' }),
            new THREE.MeshStandardMaterial({ color: 0x990000, envMap: envMap, metalness: 0.9, roughness: 0.2, name: 'red' }),
            new THREE.MeshStandardMaterial({ color: 0x000000, envMap: envMap, metalness: 0.9, roughness: 0.5, name: 'black' }),
            new THREE.MeshStandardMaterial({ color: 0xffffff, envMap: envMap, metalness: 0.9, roughness: 0.5, name: 'white' }),
            new THREE.MeshStandardMaterial({ color: 0x555555, envMap: envMap, envMapIntensity: 2.0, metalness: 1.0, roughness: 0.2, name: 'metallic' })
        ],
        glass: [
            new THREE.MeshStandardMaterial({ color: 0xffffff, envMap: envMap, metalness: 1, roughness: 0, opacity: 0.2, transparent: true, premultipliedAlpha: true, name: 'clear' }),
            new THREE.MeshStandardMaterial({ color: 0x000000, envMap: envMap, metalness: 1, roughness: 0, opacity: 0.2, transparent: true, premultipliedAlpha: true, name: 'smoked' }),
            new THREE.MeshStandardMaterial({ color: 0x001133, envMap: envMap, metalness: 1, roughness: 0, opacity: 0.2, transparent: true, premultipliedAlpha: true, name: 'blue' })
        ]
    };
}

function initMaterialSelectionMenus() {
    function addOption(name, menu) {
        let option = document.createElement('option');
        option.text = name;
        option.value = name;
        menu.add(option);
    }
    materialsLib.main.forEach(function (material) {
        addOption(material.name, bodyMatSelect);
        addOption(material.name, rimMatSelect);
    });
    materialsLib.glass.forEach(function (material) {
        addOption(material.name, glassMatSelect);
    });
    bodyMatSelect.selectedIndex = 3;
    rimMatSelect.selectedIndex = 5;
    glassMatSelect.selectedIndex = 0;
    bodyMatSelect.addEventListener('change', updateMaterials);
    rimMatSelect.addEventListener('change', updateMaterials);
    glassMatSelect.addEventListener('change', updateMaterials);
}

function updateMaterials() {
    let bodyMat = materialsLib.main[bodyMatSelect.selectedIndex];
    let rimMat = materialsLib.main[rimMatSelect.selectedIndex];
    let glassMat = materialsLib.glass[glassMatSelect.selectedIndex];
    carParts.body.forEach(part => part.material = bodyMat);
    carParts.rims.forEach(part => part.material = rimMat);
    carParts.glass.forEach(part => part.material = glassMat);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseDown(event) {
    isDragging = true;
    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    };
}

function onMouseUp(event) {
    isDragging = false;
}

function onMouseMove(event) {
    if (isDragging) {
        let deltaMove = {
            x: event.clientX - previousMousePosition.x,
            y: event.clientY - previousMousePosition.y
        };

        let deltaRotationQuaternion = new THREE.Quaternion()
            .setFromEuler(new THREE.Euler(
                toRadians(deltaMove.y * 0.5),
                toRadians(deltaMove.x * 0.5),
                0,
                'XYZ'
            ));

        camera.quaternion.multiplyQuaternions(deltaRotationQuaternion, camera.quaternion);

        previousMousePosition = {
            x: event.clientX,
            y: event.clientY
        };
    }
}

function toRadians(angle) {
    return angle * (Math.PI / 180);
}

function onTouchStart(event) {
    if (event.touches.length == 1) {
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
    }
}

function onTouchMove(event) {
    if (event.touches.length == 1) {
        touchEndX = event.touches[0].clientX;
        touchEndY = event.touches[0].clientY;

        let deltaMove = {
            x: touchEndX - touchStartX,
            y: touchEndY - touchStartY
        };

        let deltaRotationQuaternion = new THREE.Quaternion()
            .setFromEuler(new THREE.Euler(
                toRadians(deltaMove.y * 0.5),
                toRadians(deltaMove.x * 0.5),
                0,
                'XYZ'
            ));

        camera.quaternion.multiplyQuaternions(deltaRotationQuaternion, camera.quaternion);

        touchStartX = touchEndX;
        touchStartY = touchEndY;
    }
}

function onTouchEnd(event) {
    if (event.touches.length == 0) {
        touchStartX = 0;
        touchStartY = 0;
        touchEndX = 0;
        touchEndY = 0;
    }
}

function update() {
    let delta = clock.getDelta();
    if (carModel) {
        carControls.update(delta / 3);
        if (carModel.position.length() > 200) {
            carModel.position.set(0, 0, 0);
            carControls.speed = 0;
        }
        if (followCamera.checked) {
            carModel.getWorldPosition(cameraTarget);
            cameraTarget.y = 2.5;
            cameraTarget.z += distance;
            camera.position.lerp(cameraTarget, delta * damping);
        } else {
            carModel.getWorldPosition(cameraTarget);
            cameraTarget.y += 0.5;
            camera.position.set(3.25, 2.0, -5);
        }
        camera.lookAt(carModel.position);
    }
    stats.update();
}

init();
