interface VersionBadgeProps {
  version: string | null;
}

const VersionBadge = ({ version }: VersionBadgeProps) => {
  if (!version) {
    return null; // Don't render if no version is provided
  }

  return (
    <span class="bg-purple-100 text-purple-800 text-xs font-medium me-2 px-1.5 py-0.5 rounded dark:bg-purple-900 dark:text-purple-300">
      <span safe>{version}</span>
    </span>
  );
};

export default VersionBadge;
