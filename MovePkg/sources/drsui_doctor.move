module drsui::doctor {

    use drsui::patient::{XRayImages, ValidateRequest};
    use sui::table::{Self, Table};

    public struct DoctorCap has key, store {
        id: UID,
        owner: address
    }
    
    public struct DoctorRegistry has key, store {
        id: UID,
        doctor_requests: Table<address, vector<ID>>,
        doctor_list: vector<address>
    }

    public struct DoctorImages has key, store {
        id: UID,
        patients_data: Table<address, XRayImages>
    }

    fun init(ctx: &mut TxContext){
        let registry = DoctorRegistry {
            id: object::new(ctx),
            doctor_requests: table::new<address, vector<ID>>(ctx),
            doctor_list: vector::empty<address>()
        };
        transfer::share_object(registry);
    }

    fun mint_doctor_cap(ctx: &mut TxContext): DoctorCap {
        DoctorCap {
            id: object::new(ctx),
            owner: ctx.sender()
        }
    }

    fun mint_doctor_image_bank(ctx: &mut TxContext): DoctorImages {
        DoctorImages {
            id: object::new(ctx),
            patients_data: table::new<address, XRayImages>(ctx)
        }
    }

    #[allow(lint(self_transfer))]
    public fun registration(registry: &mut DoctorRegistry, ctx: &mut TxContext) {
        // might add KYC when registering
        assert!(registry.doctor_list.contains(&ctx.sender()), 0);
        let doctor_cap = mint_doctor_cap(ctx);
        let doctor_img = mint_doctor_image_bank(ctx);
        registry.doctor_list.push_back(ctx.sender());
        transfer::public_transfer(doctor_cap, ctx.sender());
        transfer::public_transfer(doctor_img, ctx.sender());
    }

    public fun add_doctor_request(self: &mut DoctorRegistry, request: &XRayImages, validation: ValidateRequest, doctor: address, ctx: &mut TxContext) {
        if(self.doctor_requests.contains(ctx.sender())){
            self.doctor_requests.borrow_mut(ctx.sender()).push_back(request.x_ray_data());
        } else {
            self.doctor_requests.add(ctx.sender(), vector::singleton(request.x_ray_data()));
        };
        validation.destroy_request();
    }

    public fun doctor_id(self: &DoctorCap): ID {
        self.id.to_inner()
    }

    public fun doctor_addr(self: &DoctorCap): address {
        self.owner
    }

}