import React, { useState, useEffect } from 'react';
import Card from '../../../shared-state/src/widgets/Card';
import Button from '../../../shared-state/src/widgets/Button';
import Modal from '../../../shared-state/src/widgets/Modal';
import { HiOutlineRectangleStack } from 'react-icons/hi2';
import { HiArrowsPointingOut } from 'react-icons/hi2';

interface ChassisViewCardProps {
  frontImage: string;
  backImage: string;
  made: string;
  showBack: boolean;
  onToggleView: () => void;
}

export default function ChassisViewCard({
  frontImage,
  backImage,
  made,
  showBack,
  onToggleView,
}: ChassisViewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [modalView, setModalView] = useState<'front' | 'back'>(showBack ? 'back' : 'front');

  // Update modal view when card view changes and modal is closed
  useEffect(() => {
    if (!isExpanded) {
      setModalView(showBack ? 'back' : 'front');
    }
  }, [showBack, isExpanded]);

  const modalImage = modalView === 'back' ? backImage : frontImage;
  const modalImageLabel = modalView === 'back' ? 'Back' : 'Front';

  return (
    <Card
      title="Chassis View"
      description="Hardware Configuration"
      icon={HiOutlineRectangleStack}
      iconColor="#FF8A5B"
      iconSize={24}
      className="rounded-lg border border-gray-200 bg-white w-full h-full text-left flex flex-col overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="flex flex-col justify-center items-center flex-1 gap-4 relative p-4 sm:p-6 min-h-[200px]">
        <div className="relative w-full flex-1 flex items-center justify-center min-h-[150px]">
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center gap-2 transition-all duration-500 ease-in-out ${
              showBack
                ? 'opacity-0 translate-x-full pointer-events-none'
                : 'opacity-100 translate-x-0'
            }`}
          >
            <div className="w-full h-full flex items-center justify-center relative group">
              <img
                src={frontImage}
                alt={`${made} Front`}
                className="max-h-[60%] max-w-[90%] w-auto h-auto object-contain"
              />
              {/* Expand button overlay */}
              <button
                onClick={() => {
                  setModalView('front');
                  setIsExpanded(true);
                }}
                className="absolute top-2 right-2 p-2 bg-white/90 hover:bg-white border border-gray-300 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center"
                title="Expand image"
                aria-label="Expand image"
              >
                <HiArrowsPointingOut className="w-4 h-4 text-gray-700" />
              </button>
            </div>
            <span className="text-sm text-gray-600 whitespace-nowrap">Front</span>
          </div>
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center gap-2 transition-all duration-500 ease-in-out ${
              showBack
                ? 'opacity-100 translate-x-0'
                : 'opacity-0 -translate-x-full pointer-events-none'
            }`}
          >
            <div className="w-full h-full flex items-center justify-center relative group">
              <img
                src={backImage}
                alt={`${made} Back`}
                className="max-h-[60%] max-w-[90%] w-auto h-auto object-contain"
              />
              {/* Expand button overlay */}
              <button
                onClick={() => {
                  setModalView('back');
                  setIsExpanded(true);
                }}
                className="absolute top-2 right-2 p-2 bg-white/90 hover:bg-white border border-gray-300 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center"
                title="Expand image"
                aria-label="Expand image"
              >
                <HiArrowsPointingOut className="w-4 h-4 text-gray-700" />
              </button>
            </div>
            <span className="text-sm text-gray-600 whitespace-nowrap">Back</span>
          </div>
        </div>
        <div className="flex justify-center w-full">
          <Button onClick={onToggleView} variant="outline">
            Show {showBack ? 'Front' : 'Back'}
          </Button>
        </div>
      </div>

      {/* Expanded Image Modal */}
      <Modal
        isOpen={isExpanded}
        onClose={() => setIsExpanded(false)}
        title={`${made} Chassis - ${modalImageLabel} View`}
        width="45vw"
        scrollable={false}
        showCloseButton={true}
      >
        <div className="flex flex-col gap-4">
          {/* Toggle button for switching views */}
          <div className="flex justify-center">
            <Button
              onClick={() => setModalView(modalView === 'front' ? 'back' : 'front')}
              variant="outline"
            >
              Show {modalView === 'front' ? 'Back' : 'Front'}
            </Button>
          </div>

          {/* Full-size image */}
          <div className="flex items-center justify-center p-4 bg-gray-50 min-h-[40vh]">
            <img
              src={modalImage}
              alt={`${made} ${modalImageLabel}`}
              className="max-w-full max-h-[50vh] w-auto h-auto object-contain"
            />
          </div>
        </div>
      </Modal>
    </Card>
  );
}
