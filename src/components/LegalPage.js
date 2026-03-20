import React from 'react';
import { useTranslation } from 'react-i18next';

const CONTENT = {
  en: {
    backToHome: 'Back to Home',
    effectiveDate: 'Effective date: March 20, 2026',
    privacy: {
      title: 'Privacy Policy',
      intro: 'TimeLeft Gatherly ("we", "our", or "us") respects your privacy. This policy explains what information we collect, why we collect it, and how we protect it.',
      sections: [
        {
          heading: 'Information We Collect',
          points: [
            'Account details such as your name, email, and profile information when you sign in.',
            'Event-related activity such as RSVPs, attendance status, ratings, and preferences.',
            'Technical data required to operate and secure the service, such as device/browser metadata and logs.'
          ]
        },
        {
          heading: 'How We Use Information',
          points: [
            'To provide core product features, including event discovery, booking, and social matching.',
            'To improve experience quality, safety, and fraud prevention.',
            'To communicate important account, product, and support updates.'
          ]
        },
        {
          heading: 'Data Sharing',
          points: [
            'We do not sell your personal data.',
            'We may share limited data with infrastructure providers that help us run the service (for example authentication, hosting, and database providers).',
            'We may disclose information when required by law or to protect users and platform integrity.'
          ]
        },
        {
          heading: 'Data Retention and Security',
          points: [
            'We retain data only as long as needed for legitimate business or legal purposes.',
            'We use reasonable administrative and technical safeguards to protect your data, but no system is 100% secure.'
          ]
        },
        {
          heading: 'Your Choices',
          points: [
            'You can review and update profile details in your account settings.',
            'You can request account deletion by contacting support.',
            'If you have questions about privacy, contact us through the support channels listed in the app.'
          ]
        }
      ]
    },
    terms: {
      title: 'Terms of Service',
      intro: 'By using TimeLeft Gatherly, you agree to these Terms of Service. If you do not agree, please do not use the service.',
      sections: [
        {
          heading: 'Eligibility and Account Use',
          points: [
            'You are responsible for maintaining accurate account information.',
            'You are responsible for activity under your account and for keeping your sign-in method secure.'
          ]
        },
        {
          heading: 'Acceptable Use',
          points: [
            'Do not misuse the platform, including harassment, fraud, abuse, or attempts to disrupt service.',
            'Do not violate applicable laws or infringe rights of others while using the app.'
          ]
        },
        {
          heading: 'Events and Community Interactions',
          points: [
            'Event participation is at your own discretion and risk.',
            'We may moderate, suspend, or remove accounts or content to protect community safety and platform integrity.'
          ]
        },
        {
          heading: 'Service Changes',
          points: [
            'We may update, improve, or discontinue features at any time.',
            'We may update these terms from time to time. Continued use after updates means you accept the revised terms.'
          ]
        },
        {
          heading: 'Limitation of Liability',
          points: [
            'The service is provided "as is" to the extent permitted by law.',
            'To the maximum extent allowed by law, we are not liable for indirect, incidental, or consequential damages resulting from use of the platform.'
          ]
        }
      ]
    }
  },
  ar: {
    backToHome: 'العودة للرئيسية',
    effectiveDate: 'تاريخ السريان: 20 مارس 2026',
    privacy: {
      title: 'سياسة الخصوصية',
      intro: 'نحن في TimeLeft Gatherly نحترم خصوصيتك. توضح هذه السياسة نوع البيانات التي نجمعها، ولماذا نجمعها، وكيف نحميها.',
      sections: [
        {
          heading: 'البيانات التي نجمعها',
          points: [
            'بيانات الحساب مثل الاسم والبريد الإلكتروني ومعلومات الملف الشخصي عند تسجيل الدخول.',
            'بيانات استخدام الفعاليات مثل الحجوزات والحضور والتقييمات والتفضيلات.',
            'بيانات تقنية لازمة لتشغيل الخدمة وحمايتها مثل معلومات الجهاز/المتصفح والسجلات.'
          ]
        },
        {
          heading: 'كيف نستخدم البيانات',
          points: [
            'لتقديم ميزات المنصة الأساسية مثل اكتشاف الفعاليات والحجز والمطابقة الاجتماعية.',
            'لتحسين الجودة والأمان ومنع إساءة الاستخدام.',
            'للتواصل بشأن التحديثات المهمة للحساب أو الخدمة أو الدعم.'
          ]
        },
        {
          heading: 'مشاركة البيانات',
          points: [
            'لا نقوم ببيع بياناتك الشخصية.',
            'قد نشارك بيانات محدودة مع مزودي البنية التحتية اللازمين لتشغيل الخدمة (مثل مزودي الاستضافة والمصادقة وقواعد البيانات).',
            'قد نكشف البيانات إذا كان ذلك مطلوبا قانونيا أو لحماية المستخدمين وسلامة المنصة.'
          ]
        },
        {
          heading: 'الاحتفاظ بالبيانات والأمان',
          points: [
            'نحتفظ بالبيانات فقط للمدة اللازمة للأغراض التشغيلية أو القانونية.',
            'نستخدم إجراءات تقنية وإدارية معقولة لحماية البيانات، لكن لا يوجد نظام آمن بنسبة 100%.'
          ]
        },
        {
          heading: 'خياراتك',
          points: [
            'يمكنك مراجعة بيانات ملفك الشخصي وتحديثها من إعدادات الحساب.',
            'يمكنك طلب حذف الحساب عبر التواصل مع الدعم.',
            'إذا كانت لديك أسئلة عن الخصوصية، يمكنك التواصل معنا عبر قنوات الدعم داخل التطبيق.'
          ]
        }
      ]
    },
    terms: {
      title: 'شروط الاستخدام',
      intro: 'باستخدامك TimeLeft Gatherly فإنك توافق على شروط الاستخدام هذه. إذا لم توافق، يرجى عدم استخدام الخدمة.',
      sections: [
        {
          heading: 'الأهلية واستخدام الحساب',
          points: [
            'أنت مسؤول عن دقة معلومات حسابك.',
            'أنت مسؤول عن الأنشطة التي تتم عبر حسابك وعن تأمين وسيلة تسجيل الدخول.'
          ]
        },
        {
          heading: 'الاستخدام المقبول',
          points: [
            'يمنع إساءة استخدام المنصة، بما في ذلك التحرش أو الاحتيال أو الإضرار بالخدمة.',
            'يمنع مخالفة القوانين أو انتهاك حقوق الآخرين أثناء استخدام التطبيق.'
          ]
        },
        {
          heading: 'الفعاليات والتفاعل المجتمعي',
          points: [
            'المشاركة في الفعاليات تكون بناء على قرارك وعلى مسؤوليتك.',
            'يجوز لنا الإشراف أو التعليق أو إزالة الحسابات أو المحتوى لحماية المجتمع وسلامة المنصة.'
          ]
        },
        {
          heading: 'تغييرات الخدمة',
          points: [
            'قد نقوم بتحديث الميزات أو تحسينها أو إيقافها في أي وقت.',
            'قد نقوم بتحديث هذه الشروط من وقت لآخر. استمرارك في الاستخدام بعد التحديث يعني موافقتك على النسخة المحدثة.'
          ]
        },
        {
          heading: 'تحديد المسؤولية',
          points: [
            'تقدم الخدمة "كما هي" بالقدر الذي يسمح به القانون.',
            'إلى أقصى حد يسمح به القانون، لا نتحمل مسؤولية الأضرار غير المباشرة أو التبعية الناتجة عن استخدام المنصة.'
          ]
        }
      ]
    }
  }
};

function LegalPage({ type = 'privacy' }) {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'ar' ? 'ar' : 'en';
  const localized = CONTENT[lang];
  const page = type === 'terms' ? localized.terms : localized.privacy;
  const isRTL = lang === 'ar';

  return (
    <div className={`legal-page${isRTL ? ' legal-page--rtl' : ''}`}>
      <div className="legal-page__container">
        <a className="legal-page__back" href="/">
          {localized.backToHome}
        </a>

        <header className="legal-page__header">
          <h1>{page.title}</h1>
          <p className="legal-page__date">{localized.effectiveDate}</p>
          <p className="legal-page__intro">{page.intro}</p>
        </header>

        <main className="legal-page__content">
          {page.sections.map((section) => (
            <section key={section.heading} className="legal-page__section">
              <h2>{section.heading}</h2>
              <ul>
                {section.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}

export default LegalPage;
