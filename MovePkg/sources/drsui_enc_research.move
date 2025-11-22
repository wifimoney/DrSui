module drsui::patient_research {
    use drsui::doctor::DoctorCap;
    use drsui::patient::XRayImages;

    // init function will generate a mock DoctorCap object
    entry fun seal_approve(id: vector<u8>, x_ray_data: &XRayImages, doctor_cap: &DoctorCap, ctx: &TxContext) {
        if(x_ray_data.get_patient() != ctx.sender()){
            assert!(doctor_cap.doctor_addr() == ctx.sender(), 0);
        }
    }
}
