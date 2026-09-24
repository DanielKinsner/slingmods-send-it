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
  // Behaviour the game notices (all originals for this build).
  { id: 'e01', event: 'idle', text: 'Dispatch here. Are we... parked? The customer can see you.' },
  { id: 'e02', event: 'idle', text: 'Just checking you have not unionized.' },
  { id: 'e03', event: 'idle', text: 'Standing still is technically the safest delivery method. It is also not a delivery.' },
  { id: 'e04', event: 'reverse', text: 'Reverse is also a direction. Technically.' },
  { id: 'e05', event: 'reverse', text: 'Going backwards. Bold logistics.' },
  { id: 'e06', event: 'crawl', text: 'The customer asks if you are walking it there.' },
  { id: 'e07', event: 'crawl', text: 'At this speed the parcels are legally a museum exhibit.' },
  { id: 'e08', event: 'top_speed', text: 'That speed is not in the handbook. There is no handbook.' },
  { id: 'e09', event: 'top_speed', text: 'Dispatch is legally required to say: please slow down. Dispatch has said it.' },
  { id: 'e10', event: 'honk', text: 'Please stop honking at the parcels. They cannot move out of the way.' },
  { id: 'e11', event: 'honk', text: 'Nobody is in front of you. That was for your own self-esteem.' },
  { id: 'e12', event: 'early_loss', text: 'We have not even left the parking lot.' },
  { id: 'e13', event: 'early_loss', text: 'New record. Unfortunately.' },
  { id: 'e14', event: 'hard_landing', text: 'That landing was measured in vertebrae.' },
  { id: 'e15', event: 'hard_landing', text: 'The boxes are fine. The boxes are always fine. Until they are not.' },
  { id: 'e16', event: 'rumble', text: 'The boxes would like to file a noise complaint.' },
  { id: 'e17', event: 'dig_site', text: 'Please do not deliver to the dig site. It has enough going on.' },
  { id: 'e18', event: 'awning_hit', text: 'The awning has been informed of your stack height.' },
  { id: 'e19', event: 'awning_hit', text: 'Low clearance. It was on the sign. The sign was also low.' },
  { id: 'e20', event: 'last_parcel', text: 'One parcel left. Protect it like it knows things.' },
  { id: 'e21', event: 'stunt_combo', text: 'Style points are not redeemable for parcels. We checked.' },
  { id: 'e22', event: 'recovered_again', text: 'Same box, second pickup. It is starting to feel like a relationship.' },
  { id: 'e23', event: 'near_bay_fast', text: 'The bay is the stopping part. Just a thought.' },
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
  { id: 'r18', event: 'slow_pass', text: 'Delivered. Eventually. The customer has aged.' }, // +
  { id: 'r19', event: 'slow_pass', text: 'Right on time, for a different day.' }, // +
  { id: 'r20', event: 'stylish_pass', text: 'Lovely stunts. The boxes are in therapy.' }, // +
  { id: 'r21', event: 'failed_crash', text: 'The vehicle has been delivered to a new orientation.' }, // +
  { id: 'r22', event: 'failed_pool', text: 'Package status: damp. Driver status: also damp.' }, // +
  { id: 'r23', event: 'passed_four', text: 'Four out of five. The fifth is on a journey of self discovery.' }, // +
  { id: 'r24', event: 'failed_insufficient_cargo', text: 'You delivered the vehicle beautifully. The vehicle was not the order.' }, // +
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
  { id: 'b07', event: 'veh_slingshot', text: 'The Slingshot. Two seats. One questionable business model.' },
  { id: 'b08', event: 'veh_ryker', text: 'The Ryker. Small shipment. Large incident report.' },
  { id: 'b09', event: 'veh_spyder', text: 'The Spyder. The responsible option. It has also found the ramp.' },
  { id: 'b10', event: 'preset_sensible', text: 'Low and sensible. Dispatch approves. Dispatch is bored, but approves.' },
  { id: 'b11', event: 'preset_regret', text: 'Express Regret. Bold. Wrong, but bold.' },
  { id: 'b12', event: 'preset_secure', text: 'Looks secure. It does look secure. That is the problem.' },
  { id: 'b13', event: 'purchase', text: 'Money well spent. Fictional money, but still.' },
  { id: 'b14', event: 'purchase', text: 'Receipt filed under: probably fine.' },
  { id: 'b15', event: 'welcome_back', text: 'Welcome back. The parcels remember you.' },
  { id: 'b16', event: 'broke', text: 'Insufficient Shop Credit. Try delivering things. It helps.' },
];

/** Rotating quips for the pause screen and loading screen (text only). */
export const HOLD_MUSIC = [
  'Your delivery is important to us. Please remain airborne.',
  'You are caller number four in the queue. The parcels are caller number one.',
  'Paused. The boxes are using this time to reflect.',
  'While you wait: the flamingo is not a required parcel. It knows.',
  'Fun fact: none of these straps were inspected.',
  'Hold music is currently being delivered. Probably.',
];

export const LOADING_QUIPS = [
  'Consulting the insurance guy…',
  'Loosening straps for realism…',
  'Teaching the flamingo to brace…',
  'Measuring the shortcut emotionally…',
  'Hiding the incident log…',
  'Inflating the tires and expectations…',
];

// Fake customer reviews on the receipt, chosen from what actually happened.
// {dest} is replaced with the destination name.
export const REVIEWS: { when: string; stars: number; text: string }[] = [
  { when: 'pool', stars: 1, text: 'My package arrived in the pool. I ordered it to the lobby. The pool is not the lobby.' },
  { when: 'pool', stars: 2, text: 'Driver waved at me from the deep end. Friendly. Wet. Mostly friendly.' },
  { when: 'crash', stars: 1, text: 'I watched the delivery vehicle perform a hobby instead of a delivery.' },
  { when: 'crash', stars: 2, text: 'Delivery person stopped to inspect the pavement. Closely. With their face.' },
  { when: 'insufficient', stars: 1, text: 'Two boxes arrived. The others, per tracking, “left to pursue other opportunities.”' },
  { when: 'perfect', stars: 5, text: 'Everything arrived square. I am suspicious. Five stars anyway.' },
  { when: 'perfect', stars: 5, text: 'Flawless. I have never been more disappointed to have nothing to complain about.' },
  { when: 'damaged', stars: 3, text: 'All my parcels are here. Some of them are now a different shape. Art, maybe.' },
  { when: 'four', stars: 4, text: 'Four boxes. The fifth one sent a postcard.' },
  { when: 'three', stars: 3, text: 'Three out of five. The driver said “that’s a majority” and left.' },
  { when: 'flamingo', stars: 5, text: 'I did not order a flamingo. I now have a flamingo. My life is better. Five stars.' },
  { when: 'shortcut', stars: 4, text: 'Saw the driver on the roof of {dest}. I have questions. Package was on time though.' },
  { when: 'slow', stars: 3, text: 'Arrived so slowly I thought it was a parade. It was not a parade.' },
  { when: 'flips', stars: 4, text: 'The truck did a flip in front of my kids. They want to be couriers now. Thanks a lot.' },
  { when: 'recovered', stars: 4, text: 'Watched the driver reverse to pick up my box off the road. Very caring. Very weird.' },
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
