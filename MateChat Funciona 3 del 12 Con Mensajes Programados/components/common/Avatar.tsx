import React from 'react';
import { User, Users } from 'lucide-react';

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  isGroup?: boolean;
}

const Avatar: React.FC<AvatarProps> = ({ name, src, size = 'md', isGroup = false }) => {
  let dims = 'w-10 h-10';
  let iconSize = 'w-5 h-5';
  
  if (size === 'sm') {
    dims = 'w-8 h-8';
    iconSize = 'w-4 h-4';
  } else if (size === 'lg') {
    dims = 'w-12 h-12';
    iconSize = 'w-6 h-6';
  }

  if (src) {
    return (
      <div className={`${dims} flex-shrink-0 rounded-full bg-gray-200 overflow-hidden`}>
        <img src={src} alt={name} className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div className={`${dims} flex-shrink-0 rounded-full bg-gray-200 flex items-center justify-center text-gray-500`}>
      {isGroup ? <Users className={iconSize} /> : <User className={iconSize} />}
    </div>
  );
};

export default Avatar;