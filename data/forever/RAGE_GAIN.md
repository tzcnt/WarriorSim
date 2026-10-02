## Rage Gain Mechanics - Confirmed via in-game testing / live logging
Rage gain is fully normalized based on weapon speed.
Weapon quality (white -> green) yields no rage bonus.
Critical hits grant no bonus (100% normal rage). Superseded by the 2026-10-01 patch notes: white-hit crits now grant 100% bonus rage (200% normal rage).
Glancing hits carry no penalty (earn 100% normal rage).
Misses and dodges grant 0 rage.

## Tested Numbers (level 8-10)
Two-Hand: 4.5 rage per second
One-Hand Main Hand: 3.46 rage per second
This resolves to a 30% innate rage bonus on two-handers.

## Still Unknown / Provisionally Implemented
Q: Do off-hand weapons get a rage penalty? Does the Dual-Wield Specialization talent completely negate it?
Provisional Implementation: Off-hand gets 50% rage gain. Dual-Wield Specialization adds 10% of that per point, so 5/5 returns it to 75% (1.5 x 50%). Before the 2026-10-01 patch notes halved the talent, it added 20% per point and 5/5 returned it to 100%.

Q: Does increased attack speed (e.g. from Flurry / haste enchants) reduce the damage per hit?
Provisional Implementation: No, damage per hit uses unmodified weapon speed.

Q: Do we get rage from extra attacks?
Provisional Implementation: Yes, same as a normal autoattack.

Q: Does WF / extra attack reset swing timer?
Provsional Implementation: Yes, same as Classic.
