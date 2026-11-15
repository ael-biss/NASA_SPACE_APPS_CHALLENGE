/**
 * Run from the project root:  node tests/launchMatrix.test.mjs
 * Checks every rocket x orbit pair with the integrated simulateLaunch().
 */
import { OrbitMechanics } from '../src/modules/launch-orbit/logic/OrbitMechanics.js';
import { calculateLiftoffTWR } from '../src/modules/launch-orbit/logic/RocketPhysics.js';
import { getRockets } from '../src/modules/launch-orbit/data/rockets.js';
import { getOrbits } from '../src/modules/launch-orbit/data/orbits.js';
import { SpacecraftConfig } from '../src/modules/spacecraft-design/logic/SpacecraftConfig.js';

const mech = new OrbitMechanics();
const baseSpec = new SpacecraftConfig({
  structureId: 'heavy-deep-space',
  solarPanelId: 'deep-space-mega',
  batteryId: 'deep-space-cells',
  propulsionId: 'bipropellant',
  antennaId: 'ka-band-deep-space',
  avionicsId: 'deep-space-core',
  thermalId: 'active-radiators',
  shieldingId: 'tantalum-poly-shield',
  reactionWheelId: 'cmg-star-tracker',
}).toSpacecraftSpec();

let failures = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  -> ' + detail : ''}`);
};

for (const rocket of getRockets()) {
  const cap = rocket.maxPayloadLeoKg ?? 0;
  for (const orbit of getOrbits()) {
    const tag = `${rocket.id} -> ${orbit.id}`;
    const totalDv = rocket.launcherDeltaVMs + mech.calculateSpacecraftDeltaV(baseSpec);
    const reqDv = mech.calculateRequiredDeltaV(orbit);
    const expectSuccess = cap >= baseSpec.totalMassKg && totalDv >= reqDv && rocket.peakLaunchG <= baseSpec.limits.maxG;

    const r = mech.simulateLaunch(rocket, baseSpec, orbit);
    if (expectSuccess) {
      check(r.success, `${tag} passes within limits`, `dv margin ${r.remainingDeltaVMs.toFixed(0)} m/s`);
    } else {
      check(!r.success && Boolean(r.failureReason), `${tag} rejected with reason`, r.failureReason);
    }

    const overSpec = { ...baseSpec, totalMassKg: cap + 1 };
    const over = mech.simulateLaunch(rocket, overSpec, orbit);
    check(!over.success, `${tag} ${cap + 1} kg overweight is rejected`);

    const twr = calculateLiftoffTWR(rocket, Math.min(cap, baseSpec.totalMassKg));
    check(twr >= 1.0, `${tag} liftoff TWR`, twr.toFixed(2));
  }
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures ? 1 : 0);
