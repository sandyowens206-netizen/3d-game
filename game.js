import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 50, 150);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// --- LIGHTING ---
scene.add(new THREE.HemisphereLight(0xffffff, 0x556644, 1.0));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(30, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

// --- PHYSICS ARRAYS ---
const solidBoxes = []; 
function createSolidBox(w, h, d, x, y, z, color, castShadow = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: color }));
    mesh.position.set(x, y, z); 
    mesh.castShadow = castShadow; mesh.receiveShadow = true;
    scene.add(mesh);
    solidBoxes.push({ minX: x - w/2, maxX: x + w/2, minY: y - h/2, maxY: y + h/2, minZ: z - d/2, maxZ: z + d/2 });
    return mesh;
}

createSolidBox(300, 1, 300, 0, -0.5, 0, 0x6ab04c, false); 
createSolidBox(20, 1.5, 20, 0, 0.75, 0, 0x8b5a2b); 
createSolidBox(20, 10, 1, 0, 6.5, -10, 0xf2efe9); 
createSolidBox(1, 10, 20, -10, 6.5, 0, 0xf2efe9); 
createSolidBox(1, 10, 20, 10, 6.5, 0, 0xf2efe9); 
createSolidBox(7, 10, 1, -6.5, 6.5, 10, 0xf2efe9); 
createSolidBox(7, 10, 1, 6.5, 6.5, 10, 0xf2efe9); 
for (let i = 0; i < 3; i++) createSolidBox(6, 0.5, 0.8, 0, (i * 0.5) + 0.25, 11 - (i * 0.8), 0x5d4037);

// Chair
const chairGroup = new THREE.Group();
chairGroup.position.set(-5, 1.5, 0); 
const seat = new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 2), new THREE.MeshStandardMaterial({ color: 0x555555 })); seat.position.y = 1.0; chairGroup.add(seat);
const backrest = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.2), new THREE.MeshStandardMaterial({ color: 0x555555 })); backrest.position.set(0, 2.0, -0.9); chairGroup.add(backrest);
for(let x of [-0.8, 0.8]) { for(let z of [-0.8, 0.8]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.0, 0.2), new THREE.MeshStandardMaterial({ color: 0x333333 })); leg.position.set(x, 0.5, z); chairGroup.add(leg); } }
scene.add(chairGroup);
solidBoxes.push({ minX: -6.1, maxX: -3.9, minY: 1.5, maxY: 2.6, minZ: -1.1, maxZ: 1.1 });
solidBoxes.push({ minX: -6.1, maxX: -3.9, minY: 2.5, maxY: 4.5, minZ: -1.9, maxZ: -0.8 }); 

// --- LOAD CHARACTER ---
let player = new THREE.Group(); 
player.position.set(0, 0, 20); 
scene.add(player);
let mixer, actions = {}, activeAction;
let playerState = 0; 
let playerModel = null;
let bones = {};

const loader = new GLTFLoader();
loader.load('https://threejs.org/examples/models/gltf/Xbot.glb', function (gltf) {
    playerModel = gltf.scene;
    playerModel.scale.set(1.2, 1.2, 1.2);
    playerModel.traverse((child) => {
        if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
        if (child.isBone) {
            if (child.name.includes('Thigh_L') || child.name.includes('UpperLeg_L')) bones.leftHip = child;
            if (child.name.includes('Thigh_R') || child.name.includes('UpperLeg_R')) bones.rightHip = child;
            if (child.name.includes('Calf_L') || child.name.includes('LowerLeg_L')) bones.leftKnee = child;
            if (child.name.includes('Calf_R') || child.name.includes('LowerLeg_R')) bones.rightKnee = child;
            if (child.name.includes('Arm_L') || child.name.includes('UpperArm_L')) bones.leftArm = child;
            if (child.name.includes('Arm_R') || child.name.includes('UpperArm_R')) bones.rightArm = child;
            if (child.name.includes('ForeArm_L') || child.name.includes('LowerArm_L')) bones.leftElbow = child;
            if (child.name.includes('ForeArm_R') || child.name.includes('LowerArm_R')) bones.rightElbow = child;
        }
    });
    player.add(playerModel);

    mixer = new THREE.AnimationMixer(playerModel);
    gltf.animations.forEach((clip) => { actions[clip.name] = mixer.clipAction(clip); });
    if (actions['idle']) { activeAction = actions['idle']; activeAction.play(); }
});

function setAction(name) {
    if (!actions[name] || activeAction === actions[name]) return;
    if (activeAction) activeAction.fadeOut(0.2);
    activeAction = actions[name]; activeAction.reset().fadeIn(0.2).play();
}

// --- PHYSICS ---
function checkCollision(x, y, z) {
    const pRadius = 0.4, pHeight = 1.8;
    for (let box of solidBoxes) {
        if (x + pRadius > box.minX && x - pRadius < box.maxX && y + pHeight > box.minY && y < box.maxY && z + pRadius > box.minZ && z - pRadius < box.maxZ) return true;
    }
    return false;
}
function getGroundHeight(x, z, currentY) {
    let highestY = 0; const pRadius = 0.4;
    for (let box of solidBoxes) {
        if (x + pRadius > box.minX && x - pRadius < box.maxX && z + pRadius > box.minZ && z - pRadius < box.maxZ) {
            if (box.maxY <= currentY + 0.5 && box.maxY > highestY) highestY = box.maxY;
        }
    }
    return highestY;
}

// --- CONTROLS ---
let cameraAngle = 0; 
let isMovingJoystick = false, moveX = 0, moveY = 0, joystickCenter = { x: 0, y: 0 };
const maxDist = 40; const zone = document.getElementById('joystick-zone'); const knob = document.getElementById('joystick-knob');

let isSwipingCamera = false, lookId = null, lastTouchX = 0, lastTouchY = 0;
let pitch = 0;

window.addEventListener('touchstart', (e) => {
    for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i]; const rect = zone.getBoundingClientRect();
        if (touch.clientX >= rect.left && touch.clientX <= rect.right && touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
            isMovingJoystick = true; joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        } else if (touch.clientX > window.innerWidth / 2 && e.target.className !== 'btn') {
            isSwipingCamera = true; lookId = touch.identifier; lastTouchX = touch.clientX; lastTouchY = touch.clientY;
        }
    }
});

window.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        if (isMovingJoystick && touch.clientX >= joystickCenter.x - 65 && touch.clientX <= joystickCenter.x + 65) {
            let dx = touch.clientX - joystickCenter.x; let dy = touch.clientY - joystickCenter.y;
            let distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > maxDist) { dx = (dx / distance) * maxDist; dy = (dy / distance) * maxDist; }
            knob.style.transform = `translate(${dx}px, ${dy}px)`;
            moveX = dx / maxDist; moveY = dy / maxDist;
        }
        if (isSwipingCamera && touch.identifier === lookId) {
            let deltaX = touch.clientX - lastTouchX; cameraAngle -= deltaX * 0.01; lastTouchX = touch.clientX;
            let deltaY = touch.clientY - lastTouchY; pitch -= deltaY * 0.01;
            pitch = Math.max(-0.5, Math.min(0.5, pitch));
            lastTouchY = touch.clientY;
        }
    }
});

window.addEventListener('touchend', (e) => {
    if (e.touches.length === 0) {
        isMovingJoystick = false; isSwipingCamera = false; knob.style.transform = `translate(0px, 0px)`; 
        moveX = 0; moveY = 0; if (playerState === 0 && !isJumping) setAction('idle');
    }
});

let isSprinting = false, isJumping = false, jumpVelocity = 0, playerSpeed = 0.12; 
const btnJump = document.getElementById('btn-jump'); const btnSprint = document.getElementById('btn-sprint'); const btnSitChair = document.getElementById('btn-sit-chair');

btnJump.addEventListener('touchstart', (e) => { e.preventDefault(); if (!isJumping && playerState === 0) { isJumping = true; jumpVelocity = 0.25; setAction('jump'); } });
btnSprint.addEventListener('touchstart', (e) => { e.preventDefault(); isSprinting = true; btnSprint.style.background = "rgba(255, 100, 0, 0.8)"; });
btnSprint.addEventListener('touchend', (e) => { e.preventDefault(); isSprinting = false; btnSprint.style.background = "rgba(0,0,0,0.5)"; });

btnSitChair.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (playerState === 0) { 
        playerState = 2; btnSitChair.innerHTML = "WALKING..."; btnSitChair.style.opacity = "0.5"; btnJump.style.display = 'none'; btnSprint.style.display = 'none';
    } 
    else if (playerState === 1) { 
        playerState = 0; player.position.set(-5, 1.5, 2); player.rotation.y = 0; resetPose(); 
        btnSitChair.innerHTML = "SIT ON CHAIR"; btnSitChair.style.display = 'none'; btnSitChair.style.opacity = "1"; btnJump.style.display = 'flex'; btnSprint.style.display = 'flex'; 
    }
});

function forceSitPose() {
    if (activeAction) activeAction.stop();
    player.position.y -= 0.4; 
    if (bones.leftHip && bones.rightHip) { bones.leftHip.rotation.x = -Math.PI / 2; bones.rightHip.rotation.x = -Math.PI / 2; }
    if (bones.leftKnee && bones.rightKnee) { bones.leftKnee.rotation.x = Math.PI / 2; bones.rightKnee.rotation.x = Math.PI / 2; }
    if (bones.leftArm && bones.rightArm) { bones.leftArm.rotation.x = -Math.PI / 4; bones.rightArm.rotation.x = -Math.PI / 4; bones.leftArm.rotation.z = Math.PI / 6; bones.rightArm.rotation.z = -Math.PI / 6; }
    if (bones.leftElbow && bones.rightElbow) { bones.leftElbow.rotation.x = Math.PI / 3; bones.rightElbow.rotation.x = Math.PI / 3; }
}

function resetPose() {
    player.position.y += 0.4; 
    if (bones.leftHip && bones.rightHip) { bones.leftHip.rotation.set(0,0,0); bones.rightHip.rotation.set(0,0,0); }
    if (bones.leftKnee && bones.rightKnee) { bones.leftKnee.rotation.set(0,0,0); bones.rightKnee.rotation.set(0,0,0); }
    if (bones.leftArm && bones.rightArm) { bones.leftArm.rotation.set(0,0,0); bones.rightArm.rotation.set(0,0,0); }
    if (bones.leftElbow && bones.rightElbow) { bones.leftElbow.rotation.set(0,0,0); bones.rightElbow.rotation.set(0,0,0); }
    if (actions['idle']) { activeAction = actions['idle']; activeAction.reset().fadeIn(0.2).play(); }
}

function updateCamera() {
    const cameraDistance = 6, cameraHeight = 3; 
    let targetX = player.position.x + Math.sin(cameraAngle) * cameraDistance;
    let targetZ = player.position.z + Math.cos(cameraAngle) * cameraDistance;
    let targetY = player.position.y + cameraHeight;

    if (checkCollision(targetX, targetY, targetZ)) { targetX = player.position.x; targetZ = player.position.z + 2; }

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, 0.15);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, 0.15);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.15);
    
    const lookAtPos = new THREE.Vector3(player.position.x, player.position.y + 1.2 + pitch, player.position.z);
    camera.lookAt(lookAtPos);
}

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer && playerState !== 1) mixer.update(delta);

    if (playerState === 0) {
        const distToChair = player.position.distanceTo(new THREE.Vector3(-5, 1.5, 0));
        if (distToChair < 4) { btnSitChair.style.display = 'flex'; } else { btnSitChair.style.display = 'none'; }
    }

    if (playerState === 2) {
        const chairPos = new THREE.Vector3(-5, 1.5, -0.1); 
        const dist = player.position.distanceTo(chairPos);
        if (dist > 0.2) {
            const dir = new THREE.Vector3().subVectors(chairPos, player.position).normalize();
            player.position.x += dir.x * 0.08; player.position.z += dir.z * 0.08;
            player.rotation.y = Math.atan2(dir.x, dir.z); setAction('walk'); 
        } else {
            player.position.set(-5, 1.5, -0.1); player.rotation.y = 0; playerState = 1; forceSitPose(); 
            btnSitChair.innerHTML = "STAND UP"; btnSitChair.style.opacity = "1";
        }
    }

    if (playerState === 0) {
        let speed = isSprinting ? (playerSpeed * 2) : playerSpeed;
        const moveAngle = Math.atan2(moveX, moveY) + cameraAngle;
        if (moveX !== 0 || moveY !== 0) {
            let nextX = player.position.x + Math.sin(moveAngle) * speed;
            let nextZ = player.position.z + Math.cos(moveAngle) * speed;
            if (!checkCollision(nextX, player.position.y, player.position.z)) player.position.x = nextX;
            if (!checkCollision(player.position.x, player.position.y, nextZ)) player.position.z = nextZ;
            player.rotation.y = THREE.MathUtils.lerp(player.rotation.y, moveAngle, 0.2);
            if (isSprinting) setAction('run'); else setAction('walk');
        } else { if (!isJumping) setAction('idle'); }
    }

    let groundY = getGroundHeight(player.position.x, player.position.z, player.position.y);
    if (groundY === -999) groundY = 0;
    if (playerState === 0) { 
        if (isJumping) {
            jumpVelocity -= 0.015; player.position.y += jumpVelocity;
            if (jumpVelocity <= 0 && player.position.y <= groundY) { player.position.y = groundY; isJumping = false; jumpVelocity = 0; setAction('idle'); }
        } else {
            if (player.position.y > groundY) {
                jumpVelocity -= 0.02; player.position.y += jumpVelocity;
                if (player.position.y <= groundY) { player.position.y = groundY; jumpVelocity = 0; }
            } else { player.position.y = groundY; jumpVelocity = 0; }
        }
    }
    updateCamera();
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
                     
