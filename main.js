// Ensure this script runs only when the document is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Basic setup for the scene, camera, and renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('container').appendChild(renderer.domElement);

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);

    // Load the car model (GLB format)
    const loaderGLB = new THREE.GLTFLoader();
    loaderGLB.load('ferrari.glb', function (gltf) {
        const car = gltf.scene;
        scene.add(car);

        // Optional: Adjust position, rotation, scale
        car.position.set(0, 0, 0);
        car.scale.set(1, 1, 1);

        // Position the camera to view the car model
        camera.position.z = 5;
    }, undefined, function (error) {
        console.error(error);
    });

    // Load the scene model (GLTF format)
    const loaderGLTF = new THREE.GLTFLoader();
    loaderGLTF.load('scene.gltf', function (gltf) {
        const sceneModel = gltf.scene;
        scene.add(sceneModel);

        // Optional: Adjust position, rotation, scale
        sceneModel.position.set(0, 0, 0);
        sceneModel.scale.set(1, 1, 1);
    }, undefined, function (error) {
        console.error(error);
    });

    // Function to animate the scene
    function animate() {
        requestAnimationFrame(animate);

        renderer.render(scene, camera);
    }

    animate();

    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
});
