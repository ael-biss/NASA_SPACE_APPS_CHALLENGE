/**
 * Run from the project root:  node tests/launchMatrix.test.mjs
 * Checks every rocket × orbit pair with the real simulateLaunch().
 */
import { OrbitMechanics } from '../src/modules/launch-orbit/logic/OrbitMechanics.js';
import { calculateLiftoffTWR } from '../src/modules/launch-orbit/logic/RocketPhysics.js';
import { getRockets } from '../src/modules/launch-orbit/data/rockets.js';
import { getOrbits } from '../src/modules/launch-orbit/data/orbits.js';

const mech = new OrbitMechanics();
let failures = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  → ' + detail : ''}`);
};

for (const rocket of getRockets()) {
  for (const orbit of getOrbits()) {
    const cap = rocket.payloadCapacityKg?.[orbit.id]?.max ?? 0;
    const tag = `${rocket.id} → ${orbit.id}`;

    if (cap === 0) {
      const r = mech.simulateLaunch(rocket, { totalMassKg: 100 }, orbit);
      check(!r.success, `${tag} unreachable is rejected`, r.reason);
      continue;
    }

    const atMax = mech.simulateLaunch(rocket, { totalMassKg: cap }, orbit);
    check(atMax.success, `${tag} max payload ${cap} kg passes`,
      `Δv margin ${atMax.deltaVMarginMs.toFixed(0)} m/s`);

    const over = mech.simulateLaunch(rocket, { totalMassKg: cap + 1 }, orbit);
    check(!over.success, `${tag} ${cap + 1} kg is rejected`);

    const twr = calculateLiftoffTWR(rocket, cap);
    check(twr >= 1.0, `${tag} liftoff TWR at max payload`, twr.toFixed(2));
  }
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures ? 1 : 0);
