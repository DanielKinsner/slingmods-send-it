// Deadpan fictional logistics. React to actual events; mock the delivery
// method, never customers or real shipping. Lines from the director kit's
// HUMOR_BANK plus originals written for this build (marked "+").

export interface Line {
  id: string;
  event: string;
  text: string;
  /** Optional course restriction. */
  course?: string;
}

export const DISPATCH: Line[] = [
  { id: 'd01', event: 'run_started', text: 'Nothing fragile. Except the schedule.' },
  { id: 'd02', event: 'run_started', text: 'Route approved by someone who has not seen it.' },
  { id: 'd03', event: 'run_started', text: 'Customer requested a contactless delivery. Try the door first.' },
  { id: 'd33', event: 'run_started', text: 'Dispatch here. Please drive like the boxes are watching. They are.' }, // +
  { id: 'd34', event: 'run_started', text: 'Reminder: the shortcut is optional. So is your dignity.' }, // +
  { id: 'd35', event: 'run_started', text: 'Your load has been rated: probably fine.' }, // +
  { id: 'd04', event: 'cargo_became_loose', text: 'Package has selected a new address.' },
  { id: 'd05', event: 'cargo_became_loose', text: 'Your shipment is exploring its options.' },
  { id: 'd06', event: 'cargo_became_loose', text: 'One parcel has declined the itinerary.' },
  { id: 'd36', event: 'cargo_became_loose', text: 'A parcel has left the vehicle. It did not say goodbye.' }, // +
  { id: 'd37', event: 'cargo_became_loose', text: 'We are now a two-stop delivery.' }, // +
  { id: 'd07', event: 'cargo_recovered', text: 'Local pickup. Extremely local.' },
  { id: 'd08', event: 'cargo_recovered', text: 'Reunited, and slightly less square.' },
  { id: 'd09', event: 'cargo_recovered', text: 'We are calling that a distribution exercise.' },
  { id: 'd10', event: 'restraint_strained', text: 'That strap would like a word.' },
  { id: 'd11', event: 'restraint_strained', text: 'The cargo has started leaning into its career.' },
  { id: 'd12', event: 'restraint_broken', text: 'Load security is now a philosophical question.' },
  { id: 'd38', event: 'restraint_broken', text: 'Strap has clocked out early.' }, // +
  { id: 'd13', event: 'clean_shortcut_landing', text: 'Express shipping.' },
  { id: 'd14', event: 'clean_shortcut_landing', text: 'That was either skill or a very expensive coincidence.' },
  { id: 'd15', event: 'clean_shortcut_landing', text: 'The road is going to take this personally.' },
  { id: 'd16', event: 'all_cargo_clean_landing', text: 'Contents may have shifted. Confidence has not.' },
  { id: 'd17', event: 'all_cargo_clean_landing', text: 'Suspiciously professional.' },
  { id: 'd18', event: 'flip_banked', text: 'This side up has been renegotiated.' },
  { id: 'd19', event: 'flip_banked', text: 'Full rotation. Partial explanation.' },
  { id: 'd39', event: 'flip_banked', text: 'For the record, the boxes did not consent to that.' }, // +
  { id: 'd20', event: 'pool_failure', text: 'Your order is now marine freight.' },
  { id: 'd21', event: 'pool_failure', text: 'Delivery attempted. Swimming achieved.' },
  { id: 'd22', event: 'pool_failure', text: 'The pool is not an approved receiving department.' },
  { id: 'd40', event: 'pool_failure', text: 'Please do not use the pool again. That was in the note.' }, // +
  { id: 'd23', event: 'inverted_failure', text: 'The underside looks great, for what that is worth.' },
  { id: 'd24', event: 'inverted_failure', text: 'Please return the vehicle to its original orientation.' },
  { id: 'd41', event: 'inverted_failure', text: 'Driver has entered horizontal mode. Stand by.' }, // +
  { id: 'd42', event: 'stuck_failure', text: 'The vehicle has chosen to live here now.' }, // +
  { id: 'd43', event: 'stuck_failure', text: 'Technically parked. Not technically delivered.' }, // +
  { id: 'd25', event: 'all_required_cargo_lost', text: 'Cargo optional. Paycheck also optional.' },
  { id: 'd26', event: 'all_required_cargo_lost', text: 'Excellent vehicle delivery. Wrong vehicle delivery.' },
  { id: 'd27', event: 'destination_overshot', text: 'You have passed the point. Literally.' },
  { id: 'd28', event: 'destination_overshot', text: 'The brake pedal has requested a meeting.' },
  { id: 'd29', event: 'flamingo_hard_impact', text: 'The flamingo has concerns.' },
  { id: 'd30', event: 'flamingo_hard_impact', text: 'One squeak means fine. Probably.' },
  { id: 'd31', event: 'flamingo_lost', text: 'The flamingo is pursuing independent work.' },
  { id: 'd44', event: 'flamingo_lost', text: 'Flamingo has been released into the wild. It will be fine. It is plastic.' }, // +
  { id: 'd32', event: 'recoverable_cargo_left_behind', text: 'You appear to be shipping in installments.' },
  { id: 'd45', event: 'big_air', text: 'Dispatch did not see that. Dispatch would like to un-see that.' }, // +
  { id: 'd46', event: 'big_air', text: 'Altitude is not a delivery metric. But go on.' }, // +
  { id: 'd47', event: 'shortcut_taken', text: 'Rooftop access confirmed. Liability not confirmed.' }, // +
  { id: 'd48', event: 'shortcut_taken', text: 'Ah. The scenic route. Vertically.' }, // +
  { id: 'd49', event: 'wipeout', text: 'Helmet: working as intended.' }, // +
  { id: 'd50', event: 'wipeout', text: 'Driver is fine. Driver is filing a report about the driver.' }, // +
  { id: 'd51', event: 'retry_spam', text: 'Same route. Same boxes. Brand new optimism.' }, // +
  { id: 'd52', event: 'retry_spam', text: 'Dispatch admires your commitment to the bit.' }, // +
  { id: 'd53', event: 'fragile_damaged', text: 'The fragile one. Of course it was the fragile one.' }, // +
  { id: 'd54', event: 'wheelie', text: 'Front wheel is taking a personal day.' }, // +
  // Course flavour.
  { id: 'p01', event: 'run_started', text: 'Pier Pressure. Mind the gulls. They are unionized.', course: 'pier' }, // +
  { id: 'p02', event: 'shortcut_taken', text: 'You are now on the snack stand roof. The snack stand has not been informed.', course: 'pier' }, // +
  { id: 'p03', event: 'pool_failure', text: 'The ocean is not a receiving department either. We checked.', course: 'pier' }, // +
  { id: 'h01', event: 'run_started', text: 'HOA No. Keep it under a reasonable speed. They will not tell you what that is.', course: 'hoa' }, // +
  { id: 'h02', event: 'shortcut_taken', text: 'You are driving on a garage. A complaint has been drafted.', course: 'hoa' }, // +
  { id: 'h03', event: 'pool_failure', text: 'That is somebody’s koi pond. Was.', course: 'hoa' }, // +
];

export const RESULTS: Line[] = [
  { id: 'r01', event: 'passed_all_five_clean', text: 'Remarkably, the contents and the packaging agree.' },
  { id: 'r02', event: 'passed_all_five_clean', text: 'All accounted for. Nobody act surprised.' },
  { id: 'r03', event: 'passed_all_five_damaged', text: 'Everything arrived. Some of it in a new shape.' },
  { id: 'r04', event: 'passed_three', text: 'Most of your order is here. Emotionally, all of it.' },
  { id: 'r05', event: 'passed_three', text: 'Three out of five. Technically a majority.' },
  { id: 'r06', event: 'passed_four', text: 'One parcel is taking the scenic route.' },
  { id: 'r07', event: 'passed_four', text: 'Four parcels and a compelling explanation.' },
  { id: 'r08', event: 'failed_insufficient_cargo', text: 'Delivery completed in spirit only.' },
  { id: 'r09', event: 'failed_insufficient_cargo', text: 'The tracking number is now more of a suggestion.' },
  { id: 'r10', event: 'passed_with_flamingo', text: 'Nobody ordered this. Five stars.' },
  { id: 'r11', event: 'passed_with_flamingo', text: 'Flamingo received. Procurement confused.' },
  { id: 'r12', event: 'new_personal_best', text: 'New personal best. Please do not update company policy.' },
  { id: 'r13', event: 'new_personal_best', text: 'Faster than last time. We will leave it at that.' },
  { id: 'r14', event: 'safe_route_clean_pass', text: 'An uneventful delivery. In this economy.' },
  { id: 'r15', event: 'failed_pool', text: 'Signed for by: the deep end.' }, // +
  { id: 'r16', event: 'failed_crash', text: 'Delivery status: pending an explanation.' }, // +
  { id: 'r17', event: 'failed_crash', text: 'Recipient was not home. Neither, briefly, was the vehicle.' }, // +
];

export const RESULT_VERDICTS = {
  passed: 'DELIVERED',
  mostly: 'DELIVERED — MOSTLY',
  failed: 'DELIVERY INCOMPLETE',
};

/** Short voice-only barks that accompany UI moments (never block play). */
export const BARKS: Line[] = [
  { id: 'b01', event: 'title', text: 'SlingMods dispatch. Your parts are out for delivery. Probably.' },
  { id: 'b02', event: 'send_it', text: 'Send it.' },
  { id: 'b03', event: 'delivered_stop', text: 'Signed, sealed, mostly delivered.' },
  { id: 'b04', event: 'delivered_stop', text: 'Package received. Receipt printing. Nobody look at the receipt.' },
  { id: 'b05', event: 'impossible', text: 'Dispatch update: not enough boxes left to pass. You may continue for practice. And for sport.' },
  { id: 'b06', event: 'garage', text: 'Welcome to the loading dock. Please choose your mistakes carefully.' },
];

export const SIGNS = {
  daysSince: 'DAYS SINCE LAST INCIDENT: 0',
  thisSideUp: 'THIS SIDE UP IS A REQUEST',
  employee: 'EMPLOYEE OF THE MONTH: RATCHET STRAP',
  wePack: 'WE PACK IT. YOU EXPLAIN IT.',
  queue: 'PLEASE FORM A RESPONSIBLE QUEUE',
};

export function allVoiceLines(): Line[] {
  return [...DISPATCH, ...RESULTS, ...BARKS];
}
