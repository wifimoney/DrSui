module drsui::patient {
    use walrus::blob::{Blob};
    use sui::clock::Clock;
    use std::string::String;
    use sui::table::{Self, Table};
    /// Represents one encrypted X-ray stored off-chain (e.g. Walrus),
    /// owned by the patient and uploaded/attested by a hospital.
    public struct PatientRegistry has key {
        id: UID,
        registry: Table<address, ID>
    }

    public struct XRayImages has key, store {
        id: UID,
        // Who actually controls this record (patient wallet)
        patient: address,
        // Who uploaded / attested the scan (hospital wallet)
        uploader: vector<address>,
        // Pointer to the encrypted blob (Walrus / storage ID, *not* raw image)
        blob: vector<Blob>,          // e.g. Walrus blob ID as bytes or string-encoded
        // whitelist: vector<address>
        body_parts: vector<String>
    }

    public struct RequestProposal has key, store {
        id: UID,
        x_ray_data: XRayImages,
        time: u64,
        duration: u64
    }

    fun init(ctx: &mut TxContext) {
        let r = PatientRegistry{
            id: object::new(ctx),
            registry: table::new<address, ID>(ctx)
        };
        transfer::share_object(r)
    }

    fun mint_request(clock: &Clock, x_ray: XRayImages, duration: u64, ctx: &mut TxContext): RequestProposal {
        RequestProposal {
            id: object::new(ctx),
            x_ray_data: x_ray,
            time: clock.timestamp_ms(),
            duration
        }
    }
    public fun audit_data(self: &mut PatientRegistry, x_ray: &mut XRayImages, body_part: String, blob: Blob, ctx: &mut TxContext) {
        assert!(self.registry.contains(ctx.sender()), 0);
        let x_ray_id = self.registry.borrow_mut(ctx.sender());
        assert!(x_ray_id == x_ray.id.to_inner(), 1);
        x_ray.uploader.push_back(ctx.sender());
        x_ray.blob.push_back(blob);
        x_ray.body_parts.push_back(body_part);
    }
    public fun upload_data_from_patient(self: &mut PatientRegistry, doctor: address, blob: Blob, body_part: String, ctx: &mut TxContext) {
        assert!(!self.registry.contains(ctx.sender()), 0);
        let x_ray = XRayImages {
            id: object::new(ctx),
            patient: ctx.sender(),
            uploader: vector::singleton(doctor),
            blob: vector::singleton(blob),
            body_parts: vector::singleton<String>(body_part)
        };
        self.registry.add(ctx.sender(), *&x_ray.id.to_inner());
        transfer::share_object(x_ray);
    }
    public fun get_patient(self: &XRayImages): address {
        self.patient
    }

    /// Getter for the object ID (as an `ID`)
    public fun request_id(request: &RequestProposal): ID {
        request.id.to_inner()
    }

    /// Getter for the request creation time (timestamp_ms)
    public fun request_time(request: &RequestProposal): u64 {
        request.time
    }

    /// Getter for the duration (in ms, e.g. 3_600_000 for 1 hour)
    public fun request_duration(request: &RequestProposal): u64 {
        request.duration
    }

    public fun request_access_a_day(clock: &Clock, x_ray: XRayImages, ctx: &mut TxContext) {
        let request_proposal = mint_request(clock, x_ray, 86_400_000, ctx);
        transfer::freeze_object(request_proposal) // will consider who will get access
    }

    public fun request_access_a_hour(clock: &Clock, x_ray: XRayImages, ctx: &mut TxContext) {
        let request_proposal = mint_request(clock, x_ray, 3_600_000, ctx);
        transfer::freeze_object(request_proposal) // will consider who will get access
    }
}
