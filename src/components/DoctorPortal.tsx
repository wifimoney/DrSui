import { useState, useEffect } from "react";
import { Inbox, Users, Settings, ZoomIn, Contrast, Ruler, Lock, Unlock, Activity, Shield } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { PatientsView } from "./doctor/PatientsView";
import { SettingsView } from "./doctor/SettingsView";
import { AuditTrailWidget } from "./doctor/AuditTrailWidget";
// import { GhostAnnotationOverlay } from "./doctor/GhostAnnotationOverlay"; // Removed annotation overlay feature
import { RequestAccessToast } from "./doctor/RequestAccessToast";
import { DoctorDashboard } from "./doctor/DoctorDashboard";
// import { ZKVerificationDashboard } from "./ZKVerificationDashboard";
import { useLanguage } from "./LanguageContext";
import { useCurrentAccount, useSignPersonalMessage, useSuiClient } from "@mysten/dapp-kit";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { blobIdFromInt } from "@mysten/walrus";
import { SealClient, SessionKey } from "@mysten/seal";
import { fromHex } from "@mysten/sui/utils";
import { Transaction } from "@mysten/sui/transactions";
import { toast } from 'sonner';

interface DoctorRequest {
  id: string;
  patientAddress: string;
  xrayImageId: string;
  requestProposalId: string;
  name: string;
  initials: string;
  condition: string;
  timestamp: string;
  requestTime: number; // Store the actual timestamp for comparison
  blobId: string; // Unique blobId for this request
  blobs: Array<{
    blobId: string;
    blobObjectId: string;
    size: string;
    bodyPart: string;
  }>;
}

export function DoctorPortal() {
  const [activeNav, setActiveNav] = useState("inbox");
  const [selectedRequest, setSelectedRequest] = useState(0);
  const [decryptedIds, setDecryptedIds] = useState<string[]>([]);
  const [decryptedImages, setDecryptedImages] = useState<Record<string, string>>({});
  const [isDecrypting, setIsDecrypting] = useState<string | null>(null);
  const [showRequestToast, setShowRequestToast] = useState(false); // Changed from true to false to prevent auto-show
  const { t } = useLanguage();
  
  const currentAccount = useCurrentAccount();
  const doctor_registry = import.meta.env.VITE_DOCTOR_REGISTRY;
  
  const package_id = import.meta.env.VITE_PACKAGE_ID;
  
  const client = new SuiJsonRpcClient({
    url: getFullnodeUrl('testnet'),
    network: 'testnet',
  });
  
  const suiClient = useSuiClient();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  
  // Seal server configuration
  const serverObjectIds = [
    "0x164ac3d2b3b8694b8181c13f671950004765c23f270321a45fdd04d40cccf0f2", 
    "0x5466b7df5c15b508678d51496ada8afab0d6f70a01c10613123382b1b8131007"
  ];
  
  const sealClient = new SealClient({
    suiClient,
    serverConfigs: serverObjectIds.map((id) => ({
        objectId: id,
        weight: 1,
    })),
    verifyKeyServers: false,
  });

  const doctorProfile = {
    name: "Dr. Jonathan Doe",
    initials: "JD",
    id: "MD-8829-XJ",
    specialty: t("doctor.profile.specialty"),
    hospital: "Sui General Hospital"
  };

  const [incomingRequests, setIncomingRequests] = useState<DoctorRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [doctorCapId, setDoctorCapId] = useState<string | null>(null);
  const [eventEmitted, setEventEmitted] = useState<boolean>(false);
  const [surfluxStatus, setSurfluxStatus] = useState<'CONNECTING' | 'OPEN' | 'CLOSED'>('CLOSED');

  // Helper function to calculate time ago
  const calculateTimeAgo = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  // Helper function to format timestamp to readable date/time
  const formatCreationTime = (timestamp: number): string => {
    if (!timestamp || timestamp === 0) return 'Unknown';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Fetch doctor requests from blockchain
  useEffect(() => {
    const fetchDoctorRequests = async () => {
      if (!currentAccount?.address || !doctor_registry) {
        console.log('No account or doctor registry');
        return;
      }

      setIsLoadingRequests(true);
      try {
        // Step 1: Fetch the DoctorRegistry object
        const registryData = await client.getObject({
          id: doctor_registry,
          options: { showContent: true },
        });

        // Step 2a: Get the doctor_caps table ID and fetch DoctorCap for this doctor
        const registryFields = (registryData as any)?.data?.content?.fields;
        
        const doctorCapsField = registryFields?.doctor_caps;
        
        const doctorCapsTableId = doctorCapsField?.fields?.id?.id;

        // Check if doctor_list contains this doctor
        const doctorList = registryFields?.doctor_list || [];
        const isDoctorInList = doctorList.includes(currentAccount.address);

        if (!isDoctorInList) {
          console.warn('⚠️ Doctor address not found in doctor_list. You may need to register as a doctor first.');
          toast.error('Not registered', {
            description: 'This wallet is not registered as a doctor. Please contact an administrator.',
          });
        }

        if (doctorCapsTableId) {
          try {
            const doctorCapData = await client.getDynamicFieldObject({
              parentId: doctorCapsTableId,
              name: {
                type: 'address',
                value: currentAccount.address,
              },
            });
            // Check if we got an error (doctor not found in table)
            if ((doctorCapData as any)?.error) {
              const errorCode = (doctorCapData as any)?.error?.code;
              console.warn('⚠️ Error fetching DoctorCap:', errorCode);
              
              if (errorCode === 'dynamicFieldNotFound') {
  
                toast.warning('Doctor Cap not found', {
                  description: 'Your doctor capability was not found. You may need to complete registration.',
                });
              }
              setDoctorCapId(null);
            } else {
              const capId = (doctorCapData as any)?.data?.content?.fields?.value;

              
              if (capId) {
                setDoctorCapId(capId);

                toast.success('Doctor verified', {
                  description: 'Your doctor credentials have been verified.',
                  duration: 2000,
                });
              } else {
                console.warn('Doctor cap data found but no value field');
       
              }
            }
          } catch (error) {
            console.error('❌ Exception fetching doctor cap:', error);
            setDoctorCapId(null);
          }
        } else {
          console.warn('No doctor_caps table ID found in registry');
        }

        // Step 2b: Get the doctor_requests table ID
        const doctorRequestsTableId = (registryData as any)?.data?.content?.fields?.doctor_requests?.fields?.id?.id;


        if (!doctorRequestsTableId) {
          console.log('No doctor requests table found');
          setIncomingRequests([]);
          return;
        }

        // Step 3: Fetch the dynamic field for this doctor's address
        const doctorRequests = await client.getDynamicFieldObject({
          parentId: doctorRequestsTableId,
          name: {
            type: 'address',
            value: currentAccount.address,
          },
        });


        // Check if dynamic field was not found (doctor has no requests yet)
        if ((doctorRequests as any)?.error?.code === 'dynamicFieldNotFound') {
          console.log('No requests found for this doctor');
          setIncomingRequests([]);
          return;
        }

        // Step 4: Get the vector of RequestProposal IDs
        const requestProposalIds = (doctorRequests as any)?.data?.content?.fields?.value;


        if (!requestProposalIds || !Array.isArray(requestProposalIds) || requestProposalIds.length === 0) {
          console.log('No request proposal IDs found');
          setIncomingRequests([]);
          return;
        }

        // Step 5: Fetch each RequestProposal to get the x_ray_data ID
        const requestPromises = requestProposalIds.map(async (proposalId: string) => {
          try {
            // Fetch the RequestProposal object
            const proposalData = await client.getObject({
              id: proposalId,
              options: { showContent: true },
            });
            console.log('Request Proposal data:', proposalData);

            const proposalFields = (proposalData as any)?.data?.content?.fields;
            const xrayId = proposalFields?.x_ray_data;
            const requestTime = proposalFields?.time;

            if (!xrayId) {
              console.log('No x_ray_data found in proposal');
              return null;
            }

            console.log('XRay ID from proposal:', xrayId);

            // Step 6: Fetch the actual XRayImages object
            const xrayData = await client.getObject({
              id: xrayId,
              options: { showContent: true },
            });

            const fields = (xrayData as any)?.data?.content?.fields;
            const patientAddress = fields?.patient || 'Unknown';
            const bodyParts = fields?.body_parts || [];
            const blobsData = fields?.blob || [];
            
            // Extract blob information
            const blobs = blobsData.map((blob: any, index: number) => {
              const blobId = blob?.fields?.blob_id || '';
              const blobObjectId = blob?.fields?.id?.id || '';
              const size = blob?.fields?.size || '0';
              const bodyPart = bodyParts[index] || 'Unknown';
              
              
              return {
                blobId,
                blobObjectId,
                size,
                bodyPart
              };
            });
            
            // Generate initials from patient address
            const initials = patientAddress.slice(2, 4).toUpperCase();
            
            // Calculate time ago from request timestamp
            const timeAgo = requestTime ? calculateTimeAgo(parseInt(requestTime)) : 'Recently';
            
            // Create a separate request for each blob to show distinct images
            // Each RequestProposal has its own distinct creation time
            return blobs.map((blob: { blobId: string; blobObjectId: string; size: string; bodyPart: string }) => ({
              id: `${proposalId}-${blob.blobId}`, // Unique ID combining requestProposalId and blobId
              patientAddress,
              xrayImageId: xrayId,
              requestProposalId: proposalId,
              name: `Patient ${patientAddress.slice(0, 6)}...${patientAddress.slice(-4)}`,
              initials,
              condition: `${blob.bodyPart} X-Ray`,
              timestamp: timeAgo,
              requestTime: requestTime ? parseInt(requestTime) : 0, // Each RequestProposal has distinct time
              blobs: [blob], // Single blob per request
              blobId: blob.blobId, // Store blobId for reference
            }));
          } catch (error) {
            console.error('Error fetching request proposal or XRay data:', error);
            return null;
          }
        });

        // Flatten the array since each request can return multiple blobs
        const allRequests = (await Promise.all(requestPromises))
          .filter(Boolean)
          .flat() as DoctorRequest[];
        
        // Sort requests by requestTime (most recent first) to ensure we get the latest ones
        const sortedRequests = allRequests.sort((a, b) => b.requestTime - a.requestTime);
        
        // Filter to keep only the most recent request for each distinct blobId
        // But each RequestProposal has its own distinct creation time
        // So we show the most recent RequestProposal for each distinct blob
        const uniqueRequestsMap = new Map<string, DoctorRequest>();
        
        for (const request of sortedRequests) {
          // Use blobId as the unique key to distinguish different images
          // Each RequestProposal (even for the same blob) has its own distinct requestTime
          const existing = uniqueRequestsMap.get(request.blobId);
          
          if (!existing || request.requestTime > existing.requestTime) {
            // Keep the most recent RequestProposal for this blob
            uniqueRequestsMap.set(request.blobId, request);
          }
        }
        
        // Convert map back to array and sort by requestTime (most recent first)
        const uniqueRequests = Array.from(uniqueRequestsMap.values())
          .sort((a, b) => b.requestTime - a.requestTime);
        
        setIncomingRequests(uniqueRequests);
        console.log('Fetched requests (filtered):', uniqueRequests);
        console.log('Original requests count:', allRequests.length, 'Unique blobIds:', uniqueRequests.length);
        console.log('Distinct X-ray images:', uniqueRequests.map(r => ({ 
          blobId: r.blobId,
          bodyPart: r.condition,
          xrayImageId: r.xrayImageId,
          requestProposalId: r.requestProposalId,
          requestTime: r.requestTime,
          patient: r.name, 
          timestamp: r.timestamp 
        })));
        
        // Explain why requestProposalIds might be the same
        const proposalIdGroups = uniqueRequests.reduce((acc, req) => {
          if (!acc[req.requestProposalId]) {
            acc[req.requestProposalId] = [];
          }
          acc[req.requestProposalId].push(req.blobId);
          return acc;
        }, {} as Record<string, string[]>);
        
        console.log('RequestProposal grouping:', proposalIdGroups);
        console.log('Explanation: Multiple blobs from the same XRayImages object share the same RequestProposal ID because they were shared in the same request.');

      } catch (error) {
        console.error('Error fetching doctor requests:', error);
        setIncomingRequests([]);
      } finally {
        setIsLoadingRequests(false);
      }
    };

    fetchDoctorRequests();
  }, [currentAccount?.address, doctor_registry]);

  // Auto-refresh requests when a new event is received
  useEffect(() => {
    if (eventEmitted) {
      console.log('🔄 New event received, refreshing requests list...');
      
      // Small delay to ensure the transaction is processed on-chain
      const refreshTimer = setTimeout(() => {
        // Re-trigger the fetch by updating a dependency
        // We'll use a refetch mechanism
        if (currentAccount?.address && doctor_registry) {
          // Re-fetch doctor requests
          const refetchRequests = async () => {
            setIsLoadingRequests(true);
            try {
              const registryData = await client.getObject({
                id: doctor_registry,
                options: { showContent: true },
              });

              const registryFields = (registryData as any)?.data?.content?.fields;
              const doctorRequestsTableId = (registryFields as any)?.doctor_requests?.fields?.id?.id;

              if (!doctorRequestsTableId) {
                setIncomingRequests([]);
                return;
              }

              const doctorRequests = await client.getDynamicFieldObject({
                parentId: doctorRequestsTableId,
                name: {
                  type: 'address',
                  value: currentAccount.address,
                },
              });

              if ((doctorRequests as any)?.error?.code === 'dynamicFieldNotFound') {
                setIncomingRequests([]);
                return;
              }

              const requestProposalIds = (doctorRequests as any)?.data?.content?.fields?.value;

              if (!requestProposalIds || !Array.isArray(requestProposalIds) || requestProposalIds.length === 0) {
                setIncomingRequests([]);
                return;
              }

              const requestPromises = requestProposalIds.map(async (proposalId: string) => {
                try {
                  const proposalData = await client.getObject({
                    id: proposalId,
                    options: { showContent: true },
                  });

                  const proposalFields = (proposalData as any)?.data?.content?.fields;
                  const xrayId = proposalFields?.x_ray_data;
                  const requestTime = proposalFields?.time;

                  if (!xrayId) return null;

                  const xrayData = await client.getObject({
                    id: xrayId,
                    options: { showContent: true },
                  });

                  const fields = (xrayData as any)?.data?.content?.fields;
                  const patientAddress = fields?.patient || 'Unknown';
                  const bodyParts = fields?.body_parts || [];
                  const blobsData = fields?.blob || [];
                  
                  const blobs = blobsData.map((blob: any, index: number) => {
                    const blobId = blob?.fields?.blob_id || '';
                    const blobObjectId = blob?.fields?.id?.id || '';
                    const size = blob?.fields?.size || '0';
                    const bodyPart = bodyParts[index] || 'Unknown';
                    
                    return {
                      blobId,
                      blobObjectId,
                      size,
                      bodyPart
                    };
                  });
                  
                  const initials = patientAddress.slice(2, 4).toUpperCase();
                  const timeAgo = requestTime ? calculateTimeAgo(parseInt(requestTime)) : 'Recently';
                  
                  return blobs.map((blob: { blobId: string; blobObjectId: string; size: string; bodyPart: string }) => ({
                    id: `${proposalId}-${blob.blobId}`,
                    patientAddress,
                    xrayImageId: xrayId,
                    requestProposalId: proposalId,
                    name: `Patient ${patientAddress.slice(0, 6)}...${patientAddress.slice(-4)}`,
                    initials,
                    condition: `${blob.bodyPart} X-Ray`,
                    timestamp: timeAgo,
                    requestTime: requestTime ? parseInt(requestTime) : 0,
                    blobs: [blob],
                    blobId: blob.blobId,
                  }));
                } catch (error) {
                  console.error('Error fetching request proposal or XRay data:', error);
                  return null;
                }
              });

              const allRequests = (await Promise.all(requestPromises))
                .filter(Boolean)
                .flat() as DoctorRequest[];
              
              const sortedRequests = allRequests.sort((a, b) => b.requestTime - a.requestTime);
              
              const uniqueRequestsMap = new Map<string, DoctorRequest>();
              
              for (const request of sortedRequests) {
                const existing = uniqueRequestsMap.get(request.blobId);
                if (!existing || request.requestTime > existing.requestTime) {
                  uniqueRequestsMap.set(request.blobId, request);
                }
              }
              
              const uniqueRequests = Array.from(uniqueRequestsMap.values())
                .sort((a, b) => b.requestTime - a.requestTime);
              
              setIncomingRequests(uniqueRequests);
              console.log('✅ Requests list refreshed after new event');
            } catch (error) {
              console.error('Error refreshing doctor requests:', error);
            } finally {
              setIsLoadingRequests(false);
            }
          };

          refetchRequests();
        }
      }, 2000);

      return () => clearTimeout(refreshTimer);
    }
  }, [eventEmitted, currentAccount?.address, doctor_registry]);

  // Surflux EventSource listener - following the sample implementation pattern
  useEffect(() => {
    const surfluxApiKey = import.meta.env.VITE_SURFLUX_API_KEY;
    
    if (!surfluxApiKey) {
      console.warn('⚠️ Surflux API key not configured');
      setSurfluxStatus('CLOSED');
      return;
    }

    // Use testnet URL as shown in the sample
    const SSE_URL = `https://testnet-flux.surflux.dev/events?api-key=${surfluxApiKey}`;
    
    // 1. Create the connection
    console.log('🔌 Connecting to Surflux...');
    setSurfluxStatus('CONNECTING');
    const eventSource = new EventSource(SSE_URL);

    // 2. Handle Connection Open
    eventSource.onopen = () => {
      console.log('✅ Surflux Connected!');
      setSurfluxStatus('OPEN');
    };

    // 3. Handle Incoming Messages
    eventSource.onmessage = (event) => {
      console.log('📨 Event received:', event.data);
      
      try {
        // Parse the JSON data
        const payload = JSON.parse(event.data);
        console.log('📦 Parsed Surflux event payload:', payload);

        // 1. Check the top-level type
        if (payload.type === 'package_event') {
          // 2. Access the nested 'data' object where the real info lives
          const eventData = payload.data;
          const eventTypeString = eventData?.event_type; // e.g., "0x123::doctor::add_doctor_request"

          // 3. Filter by checking if the string includes your package::module::event
          // The format is always: Address::Module::EventName
          if (eventTypeString && eventTypeString.includes(`${package_id}::doctor::add_doctor_request`)) {
            console.log('🎯 Patient request event detected!');
            // 'contents' holds the actual fields defined in your Move struct
            console.log('Event Contents:', eventData.contents);
            
            // Extract patient info from event contents if available
            const eventContents = eventData.contents || {};
            const patientAddress = eventContents.patient || 'Unknown';
            const bodyPart = eventContents.body_part || 'Medical Record';
            
            // Show popup notification with event details
            toast.success('New Patient Request Arrived!', {
              description: `Patient ${patientAddress.slice(0, 6)}...${patientAddress.slice(-4)} shared a ${bodyPart} record`,
              duration: 5000,
            });
            
            // Trigger refresh
            setEventEmitted(true);
            setShowRequestToast(true);
            
            // Log that event was emitted
            console.log('✅ Event emitted flag set to true - refreshing requests...');
          }
        }
      } catch (error) {
        console.error('❌ Error parsing Surflux event:', error);
      }
    };

    // 4. Handle Errors
    eventSource.onerror = (error) => {
      console.error('❌ EventSource failed:', error);
      // Native EventSource doesn't give detailed error info for security reasons
      setSurfluxStatus('CLOSED');
      eventSource.close();
    };

    // 5. CLEANUP (Crucial!)
    // This runs when the component unmounts
    return () => {
      console.log('🔌 Closing Surflux connection...');
      eventSource.close();
      setSurfluxStatus('CLOSED');
    };
  }, [package_id, currentAccount?.address]); // Re-run if package_id or account changes

  // Track eventEmitted state changes
  useEffect(() => {
    if (eventEmitted) {
      console.log('📢 Event emitted flag is true - new patient request detected');
    }
  }, [eventEmitted]);

  const handleAcceptRequest = () => {
    // Refresh the requests list
    setShowRequestToast(false);
  };

  const handleDeclineRequest = () => {
    setShowRequestToast(false);
  };

  const patientData = {
    name: "Sarah Johnson",
    age: "45",
    studyDate: "Nov 20, 2025",
    modality: "X-Ray",
    bodyPart: "Chest",
    institution: "City General Hospital",
  };

  const handleDecrypt = async (id: string, requestIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDecrypting) return;
    
    // Select this request to show it in the detail panel
    setSelectedRequest(requestIndex);
    setIsDecrypting(id);
    
    try {
      // Find the request with this ID
      const request = incomingRequests.find(req => req.id === id);
      if (!request || !request.blobs || request.blobs.length === 0) {
        throw new Error("No blob data found for this request");
      }

      // Use the first blob for now (you can modify this to handle multiple blobs)
      const blobInfo = request.blobs[0];
      const blobIdString = blobInfo.blobId;
      const bodyPart = blobInfo.bodyPart;
      
      if (!blobIdString) throw new Error("Could not find blob_id");
      
      toast.loading('Fetching encrypted data from Walrus...');
      
      // Convert blob_id to rawBlobId
      const blobIdBigInt = BigInt(blobIdString);
      const rawBlobId = blobIdFromInt(blobIdBigInt);
      const AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space';
      const fileName = `${request.patientAddress}-${bodyPart}.json`;
      const directUrl = `${AGGREGATOR}/v1/blobs/by-quilt-id/${rawBlobId}/${fileName}`;
      
      console.log('Fetching from:', directUrl);
      
      const res = await fetch(directUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const imageBlob = await res.blob();
      const imageBlobArray = new Uint8Array(await imageBlob.arrayBuffer());
      
      toast.dismiss();
      toast.loading('Creating decryption session...');
      
      // Create session key
      const sessionKey = await SessionKey.create({
          address: currentAccount?.address || '',
          packageId: package_id,
          ttlMin: 10,
          suiClient: new SuiClient({ url: getFullnodeUrl('testnet') }),
      });

      const message = sessionKey.getPersonalMessage();
      const { signature } = await signPersonalMessage({ message });
      sessionKey.setPersonalMessageSignature(signature);

      toast.dismiss();
      toast.loading('Decrypting X-ray image...');
      console.log('Doctor Cap ID:', doctorCapId);
      console.log('Request Proposal ID:', request.requestProposalId);
      console.log('X-ray Image ID:', request.xrayImageId);
      if (!doctorCapId) {
        throw new Error("Doctor capability not found. Please ensure you are registered as a doctor.");
      }
      
      // Create transaction for seal_approve
      const tx = new Transaction();
      const idBytes = fromHex("0x1");
      const moduleName = "patient_private";
      
      // Get Sui Clock object (shared object at 0x6)
      const clockObjectId = '0x6';
      
      console.log('Decryption params:', {
        xrayImageId: request.xrayImageId,
        doctorCapId,
        requestProposalId: request.requestProposalId
      });
      
      // seal_approve(id: vector<u8>, x_ray_data: &XRayImages, doctor_cap: &DoctorCap, clock: &Clock, request: &RequestProposal, ctx: &TxContext)
      tx.moveCall({
        target: `${package_id}::${moduleName}::seal_approve`,
        arguments: [
          tx.pure.vector("u8", idBytes),           // id: vector<u8>
          tx.object(request.xrayImageId),          // x_ray_data: &XRayImages
          tx.object(doctorCapId),                  // doctor_cap: &DoctorCap
          tx.object(clockObjectId),                // clock: &Clock
          tx.object(request.requestProposalId),    // request: &RequestProposal
        ]
      });
      
      const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });
      const decryptedBytes = await sealClient.decrypt({ data: imageBlobArray, sessionKey, txBytes });
      
      // Convert to image URL
      const decryptedData = new Uint8Array(decryptedBytes.buffer || decryptedBytes);
      const finalData = Uint8Array.from(decryptedData);
      const blob = new Blob([finalData], { type: "image/jpeg" });
      const url = URL.createObjectURL(blob);
      
      // Store the decrypted image
      setDecryptedImages(prev => ({ ...prev, [id]: url }));
      setDecryptedIds(prev => [...prev, id]);
      
      toast.dismiss();
      toast.success('X-ray decrypted successfully!');
    } catch (error) {
      console.error("Decryption error:", error);
      toast.dismiss();
      toast.error("Failed to decrypt", { 
        description: error instanceof Error ? error.message : String(error) 
      });
    } finally {
      setIsDecrypting(null);
    }
  };

  const isDecrypted = (id: string) => decryptedIds.includes(id);

  return (
    <div className="flex h-full min-h-[600px] relative">
      {showRequestToast && (
        <RequestAccessToast 
          onAccept={handleAcceptRequest}
          onDecline={handleDeclineRequest}
        />
      )}
      {/* Left Sidebar Navigation */}
      <aside className="w-72 bg-sidebar flex flex-col text-sidebar-foreground border-r border-sidebar-border shrink-0 transition-all duration-300">
        {/* Doctor Profile Section */}
        <div className="p-6 border-b border-sidebar-border bg-sidebar-accent/10">
          <div className="flex items-center gap-4 mb-4">
            <div className="size-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-lg shadow-glow">
              {doctorProfile.initials}
            </div>
            <div>
              <h3 className="font-semibold text-sidebar-foreground text-sm">{doctorProfile.name}</h3>
              <p className="text-xs text-primary font-medium">{doctorProfile.specialty}</p>
            </div>
          </div>
          <div className="space-y-2 bg-sidebar-accent/50 p-3 rounded-lg border border-sidebar-border">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground uppercase tracking-wider font-medium">{t("doctor.profile.id")}</span>
              <span className="text-sidebar-foreground font-mono bg-sidebar-accent px-1.5 rounded">{doctorProfile.id}</span>
            </div>
            <div className="flex justify-between text-xs items-center">
              <span className="text-muted-foreground uppercase tracking-wider font-medium">{t("doctor.profile.hospital")}</span>
              <span className="text-sidebar-foreground text-right truncate ml-2">{doctorProfile.hospital}</span>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveNav("inbox")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activeNav === "inbox"
                ? "bg-primary/10 text-primary border border-primary/20"
                : "hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground"
            }`}
          >
            <Inbox className="size-5" />
            <span className="font-medium text-sm">{t("doctor.nav.inbox")}</span>
          </button>
          <button
            onClick={() => setActiveNav("dashboard")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activeNav === "dashboard"
                ? "bg-primary/10 text-primary border border-primary/20"
                : "hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground"
            }`}
          >
            <Activity className="size-5" />
            <span className="font-medium text-sm">Recent Analyses</span>
          </button>
          <button
            onClick={() => setActiveNav("patients")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activeNav === "patients"
                ? "bg-primary/10 text-primary border border-primary/20"
                : "hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground"
            }`}
          >
            <Users className="size-5" />
            <span className="font-medium text-sm">{t("doctor.nav.patients")}</span>
          </button>
          <button
            onClick={() => setActiveNav("zk-verification")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activeNav === "zk-verification"
                ? "bg-primary/10 text-primary border border-primary/20"
                : "hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground"
            }`}
          >
            <Shield className="size-5" />
            <span className="font-medium text-sm">ZK Verification</span>
          </button>
          <button
            onClick={() => setActiveNav("settings")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activeNav === "settings"
                ? "bg-primary/10 text-primary border border-primary/20"
                : "hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground"
            }`}
          >
            <Settings className="size-5" />
            <span className="font-medium text-sm">{t("doctor.nav.settings")}</span>
          </button>
        </nav>

        <div className="p-4 mt-auto">
          <AuditTrailWidget />
        </div>
      </aside>

      {/* Main Content Area */}
      {activeNav === "dashboard" ? (
        <DoctorDashboard />
      ) : activeNav === "zk-verification" ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <Shield className="size-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">ZK Verification Dashboard</h2>
            <p className="text-muted-foreground">Coming soon...</p>
          </div>
        </div>
      ) : activeNav === "patients" ? (
        <PatientsView />
      ) : activeNav === "settings" ? (
        <SettingsView />
      ) : (
        <div className="flex-1 flex">
          {/* Left Column - Incoming Requests */}
          <div className="w-96 bg-card border-r border-border overflow-y-auto">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between mb-2">
              <h2 className="text-foreground font-semibold text-xl">{t("doctor.incoming.title")}</h2>
                {/* Surflux Connection Status Indicator */}
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${
                    surfluxStatus === 'OPEN' ? 'bg-green-500 animate-pulse' : 
                    surfluxStatus === 'CONNECTING' ? 'bg-yellow-500' : 
                    'bg-red-500'
                  }`} />
                  <span className="text-xs text-muted-foreground font-mono">
                    {surfluxStatus}
                  </span>
                </div>
              </div>
              <p className="text-muted-foreground mt-1">
                {incomingRequests.length} {t("doctor.incoming.pending")}
              </p>
            </div>

            {isLoadingRequests ? (
              <div className="p-6 text-center text-muted-foreground">
                Loading requests...
              </div>
            ) : incomingRequests.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                No incoming requests
              </div>
            ) : (
            <div className="divide-y divide-border">
              {incomingRequests.map((request, index) => {
                const decrypted = isDecrypted(request.id);
                return (
                  <div
                    key={request.id}
                    onClick={() => setSelectedRequest(index)}
                    className={`p-6 cursor-pointer transition-colors ${
                      selectedRequest === index
                        ? "bg-muted"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="size-12 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground flex-shrink-0">
                        {request.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="text-foreground font-medium">{request.name}</h3>
                          {decrypted && (
                            <Unlock className="size-3 text-primary" />
                          )}
                        </div>
                        <p className="text-muted-foreground mb-2">{request.condition}</p>
                        <p className="text-muted-foreground text-sm">{request.timestamp}</p>
                        <p className="text-muted-foreground text-xs mt-1 font-mono">
                          Created: {formatCreationTime(request.requestTime)}
                        </p>
                      </div>
                    </div>
                    <Button
                      className={`w-full mt-4 shadow-sm transition-all ${
                        decrypted 
                          ? "bg-teal-50 text-primary border border-teal-100 hover:bg-teal-100" 
                          : "bg-primary hover:bg-primary-hover text-primary-foreground"
                      }`}
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => handleDecrypt(request.id, index, e)}
                      disabled={decrypted || isDecrypting === request.id}
                    >
                      {isDecrypting === request.id ? (
                        <span className="flex items-center gap-2">
                          <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          {t("doctor.action.decrypting")}
                        </span>
                      ) : decrypted ? (
                        <span className="flex items-center gap-2">
                          <Unlock className="size-4" />
                          {t("doctor.status.decrypted")}
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Lock className="size-4" />
                          {t("doctor.action.decrypt")}
                        </span>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
            )}
          </div>

          {/* Right Column - Patient Detail View */}
          <div className="flex-1 bg-background overflow-y-auto p-8">
            {incomingRequests.length > 0 ? (
            <div className="max-w-4xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-foreground font-bold text-3xl">
                    {incomingRequests[selectedRequest]?.name}
                </h2>
                  {incomingRequests[selectedRequest] && !isDecrypted(incomingRequests[selectedRequest].id) && (
                   <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                     <Lock className="size-3" />
                     {t("doctor.status.encrypted")}
                   </div>
                )}
              </div>

              {/* X-Ray Image Placeholder */}
              <Card className="bg-black/90 border-border rounded-lg mb-6 overflow-hidden shadow-soft relative group">
                {incomingRequests[selectedRequest] && !isDecrypted(incomingRequests[selectedRequest].id) && (
                  <div className="absolute inset-0 z-20 backdrop-blur-md bg-background/10 flex flex-col items-center justify-center text-center p-6">
                    <div className="bg-background/80 p-4 rounded-full mb-4 shadow-lg">
                      <Lock className="size-8 text-muted-foreground" />
                    </div>
                    <p className="text-foreground font-medium max-w-md">
                      {t("doctor.viewer.encryptedMessage")}
                    </p>
                    <Button 
                      className="mt-6"
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => incomingRequests[selectedRequest] && handleDecrypt(incomingRequests[selectedRequest].id, selectedRequest, e)}
                      disabled={incomingRequests[selectedRequest] && isDecrypting === incomingRequests[selectedRequest].id}
                    >
                      {incomingRequests[selectedRequest] && isDecrypting === incomingRequests[selectedRequest].id ? t("doctor.action.decrypting") : t("doctor.action.decrypt")}
                    </Button>
                  </div>
                )}
                
                <div className={`aspect-[4/3] flex items-center justify-center relative transition-all duration-500 ${
                  incomingRequests[selectedRequest] && !isDecrypted(incomingRequests[selectedRequest].id) ? "blur-sm opacity-50" : "blur-0 opacity-100"
                }`}>
                  {incomingRequests[selectedRequest] && decryptedImages[incomingRequests[selectedRequest].id] ? (
                    <img 
                      src={decryptedImages[incomingRequests[selectedRequest].id]} 
                      alt="Decrypted X-Ray" 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <>
                  <div className="absolute inset-0 bg-gradient-to-br from-muted/20 to-background" />
                  <div className="relative text-muted-foreground font-medium">
                    {t("doctor.viewer.placeholder")}
                  </div>
                    </>
                  )}
                </div>
                {/* Tool Icons Row */}
                <div className="bg-card p-4 flex items-center gap-2 border-t border-border relative z-10">
                  <button className="p-2 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors">
                    <ZoomIn className="size-5" />
                  </button>
                  <button className="p-2 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors">
                    <Contrast className="size-5" />
                  </button>
                  <button className="p-2 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors">
                    <Ruler className="size-5" />
                  </button>
                </div>
              </Card>

              {/* Metadata Section */}
              <Card className="bg-card border-border rounded-lg p-6 shadow-soft relative overflow-hidden">
                {incomingRequests[selectedRequest] && !isDecrypted(incomingRequests[selectedRequest].id) && (
                   <div className="absolute inset-0 z-10 backdrop-blur-[2px] bg-background/50 flex items-center justify-center">
                     <Lock className="size-6 text-muted-foreground/50" />
                   </div>
                )}
                <h3 className="text-foreground font-semibold text-lg mb-4">{t("doctor.metadata.title")}</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide mb-1 block">
                      Request Created
                    </Label>
                    <p className="text-foreground font-medium">
                      {incomingRequests[selectedRequest] ? formatCreationTime(incomingRequests[selectedRequest].requestTime) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide mb-1 block">
                      {t("doctor.metadata.name")}
                    </Label>
                    <p className="text-foreground font-medium">
                      {incomingRequests[selectedRequest] && isDecrypted(incomingRequests[selectedRequest].id) ? patientData.name : "********"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide mb-1 block">{t("doctor.metadata.age")}</Label>
                    <p className="text-foreground font-medium">
                      {incomingRequests[selectedRequest] && isDecrypted(incomingRequests[selectedRequest].id) ? patientData.age : "**"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide mb-1 block">
                      {t("doctor.metadata.studyDate")}
                    </Label>
                    <p className="text-foreground font-medium">{patientData.studyDate}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide mb-1 block">{t("doctor.metadata.modality")}</Label>
                    <p className="text-foreground font-medium">{patientData.modality}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide mb-1 block">{t("doctor.metadata.bodyPart")}</Label>
                    <p className="text-foreground font-medium">{patientData.bodyPart}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide mb-1 block">
                      {t("doctor.metadata.institution")}
                    </Label>
                    <p className="text-foreground font-medium">{patientData.institution}</p>
                  </div>
                </div>
              </Card>
            </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No requests selected</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
