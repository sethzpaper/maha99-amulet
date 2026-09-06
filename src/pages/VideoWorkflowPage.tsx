import { VideoManagement } from '../components/VideoManagement';
import { VideoBoard } from '../components/VideoBoard';
import { type Tab } from '../routes';
import { type WorkflowStatus } from '../lib/workflow';

const stageForTab: Partial<Record<Tab, WorkflowStatus>> = {
  videoIdeas: 'idea', imageGen: 'production', storyboard: 'production',
  videoRender: 'production', videoReview: 'review', approvedVideos: 'approved',
};
export function VideoWorkflowPage({ tab }: { tab: Tab }) {
  if (tab === 'assetLibrary') return <VideoManagement />;
  if (tab === 'costTracker') return <p className="text-[var(--app-text-muted)]">ยังไม่มีข้อมูลต้นทุนคอนเทนต์</p>;
  return <VideoBoard initialStage={stageForTab[tab]} />;
}
