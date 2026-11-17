import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialPlayerState,
  createInitialProps,
  createStaticColliders,
  stepPlayerPhysics,
  stepPropsPhysics,
  throwHeldProp,
} from './physics';
import { createInitialMechanisms } from './rules';
import type { PlayerInput } from './types';

function emptyInput(): PlayerInput {
  return {
    forward: 0,
    right: 0,
    sprint: false,
    crouchHeld: false,
    jumpHeld: false,
    jumpJustPressed: false,
    dashJustPressed: false,
    lookDeltaX: 0,
    lookDeltaY: 0,
  };
}

test('player spawns on clear tiled floor and moves smoothly with WASD', () => {
  const player = createInitialPlayerState();
  const colliders = createStaticColliders();
  const startX = player.x;
  const startZ = player.z;

  const input = emptyInput();
  input.forward = 1;
  for (let i = 0; i < 20; i++) {
    stepPlayerPhysics(player, input, colliders, 0.016);
  }
  const moved = Math.hypot(player.x - startX, player.z - startZ);
  assert.ok(moved > 0.4, `expected player to move >0.4m, got ${moved}`);
  assert.equal(player.grounded, true);
});

test('player can crouch under the study desk without clipping', () => {
  const player = createInitialPlayerState();
  const colliders = createStaticColliders();
  // Position right in front of desk opening facing +Z toward desk
  player.x = -0.50;
  player.z = 0.90;
  player.yaw = Math.PI; // -sin(PI)=0, -cos(PI)=+1 (+Z)

  const input = emptyInput();
  input.crouchHeld = true;
  input.forward = 1;
  for (let i = 0; i < 45; i++) {
    stepPlayerPhysics(player, input, colliders, 0.016);
  }
  assert.ok(player.z > 1.30, `expected crouched player to enter under desk (z > 1.30), got z=${player.z}`);
  assert.equal(player.crouching, true);
});

test('thrown physics prop follows gravity arc, bounces on floor, and produces impact event', () => {
  const player = createInitialPlayerState();
  const colliders = createStaticColliders();
  const props = createInitialProps();
  const mechanisms = createInitialMechanisms();

  const ball = props.find((p) => p.id === 'sport_ball')!;
  ball.held = true;
  player.heldPropId = ball.id;
  ball.x = player.x;
  ball.y = 1.4;
  ball.z = player.z - 0.5;

  throwHeldProp(props, player, 0.8);
  assert.equal(player.heldPropId, null);
  assert.equal(ball.held, false);

  let totalImpacts = 0;
  for (let i = 0; i < 120; i++) {
    const impacts = stepPropsPhysics(props, player, colliders, mechanisms, 'sunny', 0, 0, 0.016);
    totalImpacts += impacts.length;
  }
  assert.ok(totalImpacts >= 1, 'expected thrown ball to bounce and register impact events');
  assert.ok(ball.y >= ball.halfH - 0.001, 'expected prop never to sink below floor');
});
