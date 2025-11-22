module drsui::patient_private {
    use drsui::doctor::DoctorCap;
    use drsui::patient::XRayImages;
    use sui::clock::Clock;
    use drsui::patient::RequestProposal;

    entry fun seal_approve(id: vector<u8>, x_ray_data: &XRayImages, doctor_cap: &DoctorCap, clock: &Clock, request: &RequestProposal, ctx: &TxContext) {
        if(x_ray_data.get_patient() == ctx.sender()){
            assert!(doctor_cap.doctor_addr() == ctx.sender(), 0);
            let time_limit = request.request_time()+ request.request_duration();
            assert!(time_limit >= clock.timestamp_ms(), 1);
            assert!(request.request_time() <= clock.timestamp_ms(), 2);
        }
    }
}