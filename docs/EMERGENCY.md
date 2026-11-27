# Emergencies

A patient in an emergency has two choices on the 🚨 Emergency screen.

## 1. Send an ambulance

The nearest ambulances on duty are alerted. When one accepts, the patient sees it coming, like a ride app:

- **Crew card:** service name, vehicle number plate, a **Call crew** button and a **Message** button.
- **Live updates:** the ambulance moves on the map, with the distance and arrival time updating ("1.3 km away • about 3 min").
- **On arrival:** "The crew is here".

The ambulance shares its position live and also saves it on the server every 15 seconds, so the patient still sees it move on a weak network.

## 2. I'll go to a hospital (own transport)

For a patient who can get there themselves (car, taxi, okada, on foot), or someone taking a family member:

1. **Choose the emergency.** The patient picks the type (accident, labour, chest pain, stroke, sick child, burns and so on), how they are travelling, and an optional note.
2. **See the nearest emergency units.** For each hospital, the list shows:
   - the distance and travel time
   - whether it is taking emergency patients now
   - doctors and nurses on duty
   - emergency beds free
   - whether it handles this type of emergency
   - when the information was last updated

   Hospitals that are open and handle the emergency come first.
3. **"Go here - tell them I'm coming".** The hospital gets an alert (in the app, by push notification and by SMS), and so do its doctors and nurses on staff. The alert includes the patient's medical summary: blood group, genotype, allergies, conditions, medication and next of kin.
4. **The hospital accepts and gets ready.** It sends a note such as "Come to the Emergency entrance, the trauma team is waiting", and the patient sees "✅ Lagos City Hospital is ready for you".
   - If the hospital cannot take the patient, it gives a reason and the patient chooses the next nearest hospital.
   - If there is no answer within 3 minutes, the patient is prompted to call or choose another hospital.
5. **On the way.** The patient gets directions (Google Maps), a call button, and their distance and arrival time. The hospital sees the patient getting closer.
6. **On arrival.** The patient taps "I've arrived" (or the hospital marks it). The hospital then marks the patient "handed over to the team".

## For hospitals: the Emergency unit screen

Menu → 🚨 **Emergency**. Update it at every shift change, because patients choose where to go from it:

- **Taking emergency patients:** on or off.
- **Doctors on duty, nurses on duty, emergency beds free:** tap + or −.
- **What the unit handles:** trauma, maternity, cardiac, stroke, paediatric, surgery, ICU, burns, blood bank, X-ray/CT and more.
- **Location:** to appear in the list, the hospital needs a map location. Tap "I am at the facility now", or set it under Facility info.

Incoming patients appear at the top of the screen with their medical summary and live distance. **Accept & get ready** tells the patient what to do on arrival; **Can't take** sends them to another hospital.
