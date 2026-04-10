import React, { useId } from 'react';
import { Mic, Music, Layers, Sparkles, Download, CheckCircle2, LayoutTemplate, Film, Clock, Upload } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getImageVariantUrl,
  getProjectMusicDownloadUrl,
  getProjectNarrationDownloadUrl,
  getProjectUploadedMusicTrackDownloadUrl,
  type ProjectRecord,
  type ProjectScene,
} from "@/lib/projects-api";

interface Step3AudioAndAssemblyProps {
  project: ProjectRecord | null;
  scenes: ProjectScene[];
  onExport: () => void;
  isExporting: boolean;
  onGenerateVoice: () => void;
  onGenerateMusic: () => void;
  isLoadingAudio: boolean;
  onUploadNarrationSource: (file: File) => void;
  isUploadingNarrationSource: boolean;
  onOpenAudioLab: () => void;
}

export function Step3AudioAndAssembly({
  project,
  scenes,
  onExport,
  isExporting,
  onGenerateVoice,
  onGenerateMusic,
  isLoadingAudio,
  onUploadNarrationSource,
  isUploadingNarrationSource,
  onOpenAudioLab,
}: Step3AudioAndAssemblyProps) {
  const narrationSourceInputId = useId();
  
  if (!project) return null;

  // Calcul visuel de la timeline
  const actualDuration = scenes.reduce((acc, scene) => acc + (scene.duration || 5), 0);
  const safeTotalDuration = actualDuration || 1; // Évite la division par zéro si pas de scènes
  const narrationRequiresUpload = project.audio?.narration?.voiceId === "custom-audio-upload";
  const uploadedNarrationSource = project.audio?.narration?.uploadedSource;
  const generatedNarrationSource = project.audio?.narration?.generatedSource;
  const generatedSoundtrackSource = project.audio?.music?.generatedSource;
  const musicMode = project.audio?.music?.mode || "auto";
  const uploadedNarrationReady = Boolean(uploadedNarrationSource?.storagePath);
  const uploadedTracks = Array.isArray(project.audio?.music?.uploadedTracks)
    ? project.audio.music.uploadedTracks
    : [];
  const downloadableUploadedTracks = uploadedTracks.filter((track) => Boolean(track?.storagePath));
  const uploadedTrackCount = downloadableUploadedTracks.length;
  const musicGenerationDisabled = musicMode === "uploaded" || musicMode === "none";
  const narrationUploadPending = narrationRequiresUpload && !uploadedNarrationReady;
  const musicUploadPending = musicMode === "uploaded" && uploadedTrackCount === 0;
  const narrationDownloadReady = narrationRequiresUpload
    ? uploadedNarrationReady
    : Boolean(generatedNarrationSource?.storagePath || project.audio?.narration?.status === "generated");
  const soundtrackDownloadReady = musicMode !== "uploaded"
    && musicMode !== "none"
    && Boolean(generatedSoundtrackSource?.storagePath || project.audio?.music?.status === "generated");
  const slideshowProject = (project.type || "").toLowerCase().includes("slideshow");
  const hasScenes = scenes.length > 0;
  const hasApprovedImages = hasScenes && scenes.every((scene) => Boolean(scene.approvedImageId));
  const hasApprovedVideos = slideshowProject || (hasScenes && scenes.every((scene) => Boolean(scene.approvedVideoId)));
  const captionsReady = Boolean(project.captions?.generatedAt) && Array.isArray(project.captions?.cues) && project.captions.cues.length > 0;
  const narrationReady = narrationRequiresUpload
    ? uploadedNarrationReady
    : project.audio?.narration?.status === "generated";
  const musicReady = musicMode === "none"
    ? true
    : musicMode === "uploaded"
      ? uploadedTrackCount > 0
      : project.audio?.music?.status === "generated";
  const sfxReady = project.audio?.sfx?.enabled === false || project.audio?.sfx?.status === "generated";
  const exportReady = hasScenes && hasApprovedImages && hasApprovedVideos && captionsReady && narrationReady && musicReady && sfxReady;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      
      {/* ── UPPER CONTROL CENTER (Agent 6, 7, 8) ── */}
      <div className="flex-1 px-8 py-5 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          
          <div className="text-center space-y-1.5 mb-5">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">Assembly Room</h2>
            <p className="text-[10px] text-white/40 max-w-lg mx-auto leading-relaxed">
              Your video scenes are ready. Validate your predefined audio settings to inject voice, soundtrack and sound design into the timeline.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Agent 6: Voice */}
            <div className="rounded-2xl border border-white/4 bg-white/1 overflow-hidden flex flex-col hover:border-[#9b6dff]/30 transition-all duration-300">
              <div className="p-3 flex flex-col items-center justify-center text-center space-y-1.5 cursor-default">
                <div className="h-8 w-8 rounded-full border border-white/10 bg-black flex items-center justify-center text-white/40">
                  <Mic className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-[#9b6dff]">Agent 6 — Voiceover</h3>
                </div>
                <p className="text-[8px] text-white/30 leading-relaxed max-w-[200px]">
                  Final rendering of voices using the configuration defined in the Audio Lab.
                </p>
              </div>
              
              <div className="p-3 border-t border-white/4 bg-black/20 space-y-2 flex-1">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black uppercase tracking-widest text-white/40">Configured</label>
                    <Badge variant="outline" className={`text-[8px] uppercase transition-colors ${
                      project.audio?.narration?.status === 'generated'
                        ? 'border-[#22c55e]/30 text-[#22c55e]'
                        : project.audio?.narration?.status === 'uploaded' && uploadedNarrationReady
                          ? 'border-sky-400/30 text-sky-300'
                        : narrationUploadPending
                          ? 'border-amber-400/30 text-amber-300'
                        : 'border-[#9b6dff]/30 text-[#9b6dff]'
                    }`}>
                      {project.audio?.narration?.status === 'generated'
                        ? 'Generated'
                        : project.audio?.narration?.status === 'uploaded' && uploadedNarrationReady
                          ? 'Uploaded'
                          : narrationUploadPending
                            ? 'Upload needed'
                            : 'Ready'}
                    </Badge>
                  </div>
                  <div className="h-8 rounded-xl border border-white/10 bg-white/2 flex items-center px-3 justify-between">
                    <span className="text-[9px] font-medium text-white/60 truncate">
                      {narrationRequiresUpload
                        ? uploadedNarrationReady
                          ? uploadedNarrationSource?.name || "Uploaded narration source"
                          : "Awaiting custom narration source"
                        : project.audio?.narration?.voiceId || project.settings?.voiceId || "Default Voice"}
                    </span>
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#22c55e]/40 shrink-0" />
                  </div>
                  {narrationRequiresUpload && uploadedNarrationSource?.sizeLabel ? (
                    <p className="text-[9px] text-white/35">{uploadedNarrationSource.sizeLabel}</p>
                  ) : null}
                  {!narrationRequiresUpload && generatedNarrationSource?.sizeLabel ? (
                    <p className="text-[9px] text-white/35">{generatedNarrationSource.sizeLabel}</p>
                  ) : null}
                  {project.audio?.narration?.status === 'generating' && (
                    <p className="text-[9px] text-[#9b6dff] animate-pulse font-medium">Generating...</p>
                  )}
                </div>
              </div>
              
              <div className="p-3 pt-0 bg-black/20">
                <div className="space-y-2">
                  {narrationRequiresUpload ? (
                    <>
                    <input
                      id={narrationSourceInputId}
                      type="file"
                      accept="audio/*,.mp3,.wav,.m4a,.aiff"
                      className="hidden"
                      onChange={(event) => {
                        const nextFile = event.target.files?.[0];

                        if (nextFile) {
                          onUploadNarrationSource(nextFile);
                        }

                        event.currentTarget.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      onClick={() => window.document.getElementById(narrationSourceInputId)?.click()}
                      disabled={isUploadingNarrationSource}
                      className="w-full h-8 rounded-xl bg-white/10 hover:bg-sky-400/20 text-white hover:text-sky-300 transition-all text-[9px] font-black uppercase tracking-widest"
                    >
                      {isUploadingNarrationSource ? <Sparkles className="h-3 w-3 mr-2 animate-spin" /> : <Upload className="h-3 w-3 mr-2" />}
                      {uploadedNarrationSource ? "Replace Narration Source" : "Upload Narration Source"}
                    </Button>
                    </>
                  ) : (
                    <Button 
                      onClick={onGenerateVoice}
                      disabled={isLoadingAudio}
                      className="w-full h-8 rounded-xl bg-white/10 hover:bg-[#9b6dff]/20 text-white hover:text-[#9b6dff] transition-all text-[9px] font-black uppercase tracking-widest">
                      {isLoadingAudio ? <Sparkles className="h-3 w-3 mr-2 animate-spin" /> : null}
                      Generate Voice
                    </Button>
                  )}
                  {narrationDownloadReady ? (
                    <Button
                      asChild
                      variant="outline"
                      className="w-full h-8 rounded-xl border-white/10 bg-white/5 text-white/80 hover:bg-white/10 text-[9px] font-black uppercase tracking-widest"
                    >
                      <a href={getProjectNarrationDownloadUrl(project.id, true)} download>
                        <Download className="h-3 w-3 mr-2" />
                        Download Voice Track
                      </a>
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Agent 7: Music */}
            <div className="rounded-2xl border border-white/4 bg-white/1 overflow-hidden flex flex-col hover:border-[#22c55e]/30 transition-all duration-300">
              <div className="p-3 flex flex-col items-center justify-center text-center space-y-1.5 cursor-default">
                <div className="h-8 w-8 rounded-full border border-white/10 bg-black flex items-center justify-center text-white/40">
                  <Music className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-[#22c55e]">Agent 7 — Music</h3>
                </div>
                <p className="text-[8px] text-white/30 leading-relaxed max-w-[200px]">
                  Rendering the music track based on your choices in the Audio Lab.
                </p>
              </div>

              <div className="p-3 border-t border-white/4 bg-black/20 space-y-2 flex-1">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black uppercase tracking-widest text-white/40">Configured</label>
                    <Badge variant="outline" className={`text-[8px] uppercase transition-colors ${
                      project.audio?.music?.status === 'generated'
                        ? 'border-[#22c55e]/30 text-[#22c55e]'
                        : musicMode === 'uploaded' && uploadedTrackCount > 0
                          ? 'border-sky-400/30 text-sky-300'
                          : musicUploadPending
                            ? 'border-amber-400/30 text-amber-300'
                          : musicMode === 'none'
                            ? 'border-white/15 text-white/35'
                        : 'border-white/20 text-white/40'
                    }`}>
                      {project.audio?.music?.status === 'generated'
                        ? 'Generated'
                        : musicMode === 'uploaded' && uploadedTrackCount > 0
                          ? 'Uploaded'
                          : musicUploadPending
                            ? 'Upload needed'
                          : musicMode === 'none'
                            ? 'Disabled'
                            : 'Ready'}
                    </Badge>
                  </div>
                  <div className="h-8 rounded-xl border border-white/10 bg-white/2 flex items-center px-3 justify-between">
                    <span className="text-[9px] font-medium text-white/60 truncate">
                      {musicMode === "uploaded"
                        ? uploadedTrackCount > 0
                          ? `${uploadedTrackCount} uploaded track${uploadedTrackCount > 1 ? "s" : ""}`
                          : "Awaiting uploaded tracks"
                        : musicMode === "none"
                          ? "Music disabled"
                          : project.audio?.music?.mood || "Cinematic / Epic"}
                    </span>
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#22c55e]/40 shrink-0" />
                  </div>
                  {generatedSoundtrackSource?.sizeLabel ? (
                    <p className="text-[9px] text-white/35">{generatedSoundtrackSource.sizeLabel}</p>
                  ) : null}
                  {musicMode === "uploaded" && uploadedTrackCount > 0 ? (
                    <div className="space-y-1.5 pt-1">
                      {downloadableUploadedTracks.map((track) => (
                        <div key={track.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/3 px-2.5 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-[9px] font-medium text-white/60">{track.name}</p>
                            <p className="text-[8px] uppercase tracking-[0.16em] text-white/25">{track.sizeLabel}</p>
                          </div>
                          {track.storagePath ? (
                            <a
                              href={getProjectUploadedMusicTrackDownloadUrl(project.id, track.id, true)}
                              download
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 transition hover:bg-white/10 hover:text-white"
                            >
                              <Download className="h-3 w-3" />
                            </a>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {project.audio?.music?.status === 'generating' && (
                    <p className="text-[9px] text-[#22c55e] animate-pulse font-medium">Generating...</p>
                  )}
                </div>
              </div>

              <div className="p-3 pt-0 bg-black/20">
                <div className="space-y-2">
                  <Button 
                    onClick={onGenerateMusic}
                    disabled={isLoadingAudio || musicGenerationDisabled}
                    className="w-full h-8 rounded-xl bg-white/10 hover:bg-[#22c55e]/20 text-white hover:text-[#22c55e] transition-all text-[9px] font-black uppercase tracking-widest">
                    {isLoadingAudio ? <Sparkles className="h-3 w-3 mr-2 animate-spin" /> : null}
                    {musicMode === "uploaded"
                      ? "Using Uploaded Tracks"
                      : musicMode === "none"
                        ? "Music Disabled"
                        : project.audio?.sfx?.enabled === false
                          ? "Generate Soundtrack"
                          : "Generate Soundtrack + SFX"}
                  </Button>
                  {musicMode === "uploaded" && uploadedTrackCount === 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onOpenAudioLab}
                      className="w-full h-8 rounded-xl border-white/10 bg-white/5 text-white/80 hover:bg-white/10 text-[9px] font-black uppercase tracking-widest"
                    >
                      Open Audio Lab
                    </Button>
                  ) : null}
                  {soundtrackDownloadReady ? (
                    <Button
                      asChild
                      variant="outline"
                      className="w-full h-8 rounded-xl border-white/10 bg-white/5 text-white/80 hover:bg-white/10 text-[9px] font-black uppercase tracking-widest"
                    >
                      <a href={getProjectMusicDownloadUrl(project.id, true)} download>
                        <Download className="h-3 w-3 mr-2" />
                        Download Soundtrack
                      </a>
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Agent 8: Assembly & Export */}
            <div className="rounded-2xl border border-[#9b6dff]/20 bg-gradient-to-b from-[#9b6dff]/10 to-[#9b6dff]/[0.02] flex flex-col">
              <div className="p-3 flex-1 flex flex-col items-center justify-center text-center space-y-2">
                <div className="inline-flex items-center justify-center p-2 rounded-full bg-[#9b6dff]/20 text-[#9b6dff] shadow-[0_0_30px_-5px_rgba(155,109,255,0.4)]">
                   <Layers className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9b6dff]">Agent 8 — Assembly</h3>
                  <p className="text-[8px] text-white/50 max-w-[200px] mx-auto mt-1 leading-relaxed">
                    All scenes will be assembled and synchronized with the generated audio.
                  </p>
                </div>
              </div>
              
              <div className="p-3 pt-0">
                <Button
                  onClick={onExport}
                  disabled={isExporting || !exportReady}
                  className="w-full h-10 rounded-xl bg-[#5c2d91] text-white text-[9px] font-black uppercase tracking-[0.2em] hover:bg-[#7140b4] transition-all duration-500 shadow-[0_0_20px_-5px_rgba(92,45,145,0.5)] hover:shadow-[0_0_30px_0_rgba(155,109,255,0.6)]"
                >
                  {isExporting ? (
                    <><Sparkles className="h-4 w-4 mr-2 animate-spin" /> Assembling...</>
                  ) : (
                    <><Download className="h-4 w-4 mr-2" /> Launch Final Export</>
                  )}
                </Button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── BOTTOM TIMELINE ── */}
      <div className="h-80 border-t border-white/4 bg-[#050505] flex flex-col flex-shrink-0 shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.8)] z-10 relative">
        {/* En-tête Timeline */}
        <div className="h-10 border-b border-white/4 bg-[#08080c] flex items-center px-6 justify-between shrink-0">
          <div className="flex items-center gap-3">
             <LayoutTemplate className="h-4 w-4 text-white/20" />
             <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Timeline d'Assemblage (Agent 8)</p>
          </div>
          <div className="flex items-center gap-2">
             <Clock className="h-3 w-3 text-white/30" />
             <p className="text-[10px] font-mono text-white/40">{(actualDuration).toFixed(1)}s Total</p>
          </div>
        </div>
        
        {/* Pistes de Timeline */}
        <ScrollArea className="flex-1 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px)]" style={{ backgroundSize: '10% 100%' }}>
          <div className="p-6 space-y-3 relative overflow-hidden">
            
            {/* Barre Playhead Statique alignée après les labels (p-6 = 1.5rem, w-24 = 6rem -> 7.5rem) */}
            <div className="absolute top-6 bottom-6 left-[7.5rem] w-px bg-[#9b6dff]/60 z-30 pointer-events-none">
               <div className="absolute -top-3 -translate-x-1/2 rounded-sm bg-[#9b6dff] px-1 text-[7px] font-mono text-black font-bold">0:00</div>
            </div>

            {/* TRACK 1: Video */}
            <div className="flex bg-black/50 rounded-lg overflow-hidden h-24 border border-white/5 relative shadow-inner">
              <div className="absolute w-24 left-0 top-0 bottom-0 bg-[#0a0a0f] border-r border-white/10 z-20 flex flex-col justify-center px-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-white/60 flex items-center gap-1.5 mb-1"><Film className="h-3 w-3" /> VID</span>
                <span className="text-[7px] text-white/20 font-medium tracking-wide leading-tight">Master Video</span>
              </div>
              <div className="flex-1 ml-24 flex relative group bg-[#0a0a0f]">
                {scenes.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white/20 uppercase tracking-widest font-black">
                    Timeline vide (Aucune scène)
                  </div>
                ) : scenes.map((scene, i) => (
                  <div 
                    key={scene.id} 
                    style={{ width: `${((scene.duration || 5) / safeTotalDuration) * 100}%` }}
                    className="border-r border-[#000] flex flex-col bg-[#1a1a24] relative overflow-hidden transition-all hover:bg-[#20202d] hover:z-10"
                  >
                    {scene.approvedImageId && (
                       <img src={getImageVariantUrl(scene.approvedImageId)} className="absolute inset-0 h-full w-full object-cover opacity-60 mix-blend-luminosity grayscale group-hover:grayscale-0 transition-all duration-500" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black to-transparent" />
                    <div className="absolute inset-0 ring-1 ring-inset ring-white/5 hover:ring-white/20" />
                     <div className="absolute bottom-1 left-2 flex items-center gap-1">
                        <span className="text-[8px] font-black bg-black/80 px-1 py-0.5 rounded text-white/80 border border-white/10">S{i+1}</span>
                        <span className="text-[7px] text-white/40 drop-shadow-md font-mono hidden md:inline">{(scene.duration || 0).toFixed(1)}s</span>
                     </div>
                  </div>
                ))}
              </div>
            </div>

            {/* TRACK 2: Voice Narration */}
            <div className="flex bg-black/50 rounded-lg overflow-hidden h-14 border border-white/5 relative shadow-inner">
              <div className="absolute w-24 left-0 top-0 bottom-0 bg-[#0a0a0f] border-r border-white/10 z-20 flex flex-col justify-center px-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#9b6dff]/80 flex items-center gap-1.5 mb-1"><Mic className="h-3 w-3" /> VO</span>
                <span className="text-[7px] text-[#9b6dff]/40 font-medium tracking-wide leading-tight">Dialogue</span>
              </div>
              <div className="flex-1 ml-24 flex relative p-0.5">
                 <div className="w-full h-full bg-[#9b6dff]/10 rounded border border-[#9b6dff]/20 overflow-hidden relative shadow-[inset_0_0_15px_rgba(155,109,255,0.1)]">
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, #9b6dff 2px, #9b6dff 4px)' }}></div>
                    <div className="absolute inset-0 flex items-center pl-4">
                        <span className="text-[8px] font-black uppercase tracking-widest text-[#9b6dff]">
                          {project.audio?.narration?.status === 'generating' ? 'Génération en cours...' : '— Audio Spatialisés'}
                        </span>
                    </div>
                 </div>
              </div>
            </div>

            {/* TRACK 3: Music / SFX */}
            <div className="flex bg-black/50 rounded-lg overflow-hidden h-10 border border-white/5 relative shadow-inner">
              <div className="absolute w-24 left-0 top-0 bottom-0 bg-[#0a0a0f] border-r border-white/10 z-20 flex flex-col justify-center px-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#22c55e]/80 flex items-center gap-1.5 mb-1"><Music className="h-3 w-3" /> SFX</span>
                <span className="text-[7px] text-[#22c55e]/40 font-medium tracking-wide leading-tight">Music Bed</span>
              </div>
              <div className="flex-1 ml-24 flex relative p-0.5">
                 <div className="w-full h-full bg-[#22c55e]/10 rounded border border-[#22c55e]/20 overflow-hidden relative shadow-[inset_0_0_15px_rgba(34,197,94,0.1)]">
                    <div className="absolute inset-0 opacity-20 bg-gradient-to-r from-transparent via-[#22c55e] to-transparent bg-[length:200%_100%] animate-[pulse_8s_ease-in-out_infinite]"></div>
                    <div className="absolute inset-0 flex items-center pl-4">
                       <span className="text-[8px] font-black uppercase tracking-widest text-[#22c55e]">
                         {project.audio?.music?.status === 'generating' ? 'Génération en cours...' : '— Mixage Stéréo Complet'}
                       </span>
                    </div>
                 </div>
              </div>
            </div>

          </div>
        </ScrollArea>
      </div>

    </div>
  );
}
