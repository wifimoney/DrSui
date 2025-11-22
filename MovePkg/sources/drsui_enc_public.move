module drsui::client_decryption {
    use drsui::doctor::DoctorCap;
    use drsui::patient::XRayImages;

    // init function will generate a mock DoctorCap object
    entry fun seal_approve(id: vector<u8>, x_ray_data: &XRayImages, ctx: &TxContext) {
        assert!(ctx.sender() == x_ray_data.get_patient(), 0);
    }
}