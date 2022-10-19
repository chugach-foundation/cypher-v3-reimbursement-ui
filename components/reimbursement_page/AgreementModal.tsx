import Button from "components/Button"
import Modal from "components/Modal"
import { ElementTitle } from "components/styles"

const AgreementModal = ({
  isOpen,
  onClose,
  onAggree,
}: {
  isOpen: boolean
  onClose?: (x) => void
  onAggree: () => void
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <Modal.Header>
        <ElementTitle noMarginBottom>Agreement</ElementTitle>
      </Modal.Header>
      <div className="space-y-2">
        <div className="flex items-center justify-center pb-4 text-th-fgd-3">
          Lorem ipsum
        </div>
      </div>
      <div className="flex justify-center">
        <Button className="mt-6" onClick={onAggree}>
          I agree
        </Button>
      </div>
    </Modal>
  )
}

export default AgreementModal
