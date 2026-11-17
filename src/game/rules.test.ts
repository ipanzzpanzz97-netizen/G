import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialProps } from './physics';
import { createInitialMechanisms, createInitialRulesState, evaluateGameRules } from './rules';

test('laundry tossed into hallway basket increments objective and awards trick-shot score', () => {
  const rules = createInitialRulesState('challenge');
  const props = createInitialProps();
  const mechanisms = createInitialMechanisms();

  const laundryIds = ['teal_pouch', 'rose_cloth', 'plaid_shirt'];
  for (const id of laundryIds) {
    const item = props.find((p) => p.id === id)!;
    item.x = -2.18;
    item.y = 0.25;
    item.z = 1.15;
    item.bounces = 1;
  }

  const res = evaluateGameRules(rules, props, mechanisms, false, false, 0.016);
  const obj = rules.objectives.find((o) => o.id === 'laundry_basket')!;
  assert.equal(obj.current, 3);
  assert.equal(obj.completed, true);
  assert.ok(rules.score > 0);
  assert.ok(res.scoreEvents.length === 3);
});

test('completing all objectives triggers Victory, and 0 room integrity triggers Game Over', () => {
  const rules = createInitialRulesState('challenge');
  const props = createInitialProps();
  const mechanisms = createInitialMechanisms();

  mechanisms.northWindowOpen = false;
  mechanisms.eastWindowOpen = false;

  for (const id of ['teal_pouch', 'rose_cloth', 'plaid_shirt']) {
    const item = props.find((p) => p.id === id)!;
    item.x = -2.18;
    item.y = 0.25;
    item.z = 1.15;
  }
  for (const id of ['desk_mug', 'snack_jar']) {
    const item = props.find((p) => p.id === id)!;
    item.x = -0.8;
    item.y = 0.65;
    item.z = -1.3;
  }
  rules.objectives.find((o) => o.id === 'clear_anomalies')!.current = 3;

  const winRes = evaluateGameRules(rules, props, mechanisms, true, true, 0.016);
  assert.equal(winRes.ended, true);
  assert.equal(rules.victory, true);

  // Defeat test
  const loseRules = createInitialRulesState('challenge');
  loseRules.roomIntegrity = 0;
  const loseRes = evaluateGameRules(loseRules, props, mechanisms, false, false, 0.016);
  assert.equal(loseRes.ended, true);
  assert.equal(loseRules.victory, false);
});
