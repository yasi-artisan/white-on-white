// Source of truth for origami "01".
//
// Each map entry is ONE rigid polygon of the UNFOLDED (flat) crease pattern —
// the target pose the animation morphs into. Keys are stable polygon names so
// you can address individual flaps for timing or transforms.
//
// Coordinates come straight from src/assets/origami/01.svg. The near-duplicate
// values (e.g. 237.917 vs 237.918) are left as-is; in the unfolded pose they
// coincide, so the shared edges read as seamless.
export const orig1 = new Map<string, string>([
	["poly1", "M87.0789 162.016L94.0947 144.477L343.154 173.943L237.917 387.923L87.0789 162.016Z"],
	["poly2", "M343.154 173.943L588.705 313.556L402.086 366.876L237.918 387.923L343.154 173.943Z"],
	["poly3", "M229.491 375.302L1.48678 415.284L87.0789 162.016L229.491 375.302Z"],
	["poly4", "M599.229 365.473L402.086 366.876L237.918 387.923L419.625 498.07L599.229 365.473Z"],
	["poly5", "M1.48678 415.284L202.839 477.725L419.625 498.07L237.917 387.923L229.491 375.302L1.48678 415.284Z"],
	["poly6", "M588.705 313.556L393.312 202.461L409.102 185.168L588.705 313.556Z"],
	["poly7", "M588.705 313.556L571.867 129.042L409.102 185.168L588.705 313.556Z"],
	["poly8", "M599.228 365.473L583.092 2.75841L571.867 129.042L588.705 313.556L402.086 366.876L599.228 365.473Z"],
	["poly9", "M409.102 185.168L583.092 2.75841L571.867 129.042L409.102 185.168Z"],
]);
