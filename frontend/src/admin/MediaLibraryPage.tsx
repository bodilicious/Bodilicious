
import MediaLibrary from '../components/MediaLibrary';

export default function MediaLibraryPage() {
  return (
    <div className="h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full overflow-hidden flex flex-col">
        <MediaLibrary mode="manage" />
      </div>
    </div>
  );
}
